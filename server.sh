#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$PROJECT_DIR/venv/bin/python"
APP_MODULE="app.main:app"
ENV_FILE="$PROJECT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HOST="${APP_HOST:-0.0.0.0}"
PORT="${APP_PORT:-8090}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
ENABLE_TAILSCALE_SERVE="${ENABLE_TAILSCALE_SERVE:-1}"
TAILSCALE_SERVE_PORT="${TAILSCALE_SERVE_PORT:-443}"
TAILSCALE_TARGET_URL="http://127.0.0.1:${PORT}"
TAILSCALE_SERVE_STRICT="${TAILSCALE_SERVE_STRICT:-0}"
SERVER_START_TIMEOUT_SECONDS="${SERVER_START_TIMEOUT_SECONDS:-30}"
HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-0}"
HF_HUB_DISABLE_TELEMETRY="${HF_HUB_DISABLE_TELEMETRY:-1}"

PYTHON_CMD=()

require_file() {
  local path="$1"
  local message="$2"

  if [[ ! -e "$path" ]]; then
    printf 'Error: %s\n' "$message" >&2
    exit 1
  fi
}

require_executable() {
  local path="$1"
  local message="$2"

  if [[ ! -x "$path" ]]; then
    printf 'Error: %s\n' "$message" >&2
    exit 1
  fi
}

check_command() {
  local command_name="$1"

  command -v "$command_name" >/dev/null 2>&1
}

resolve_python_command() {
  if [[ -x "$PYTHON_BIN" ]] && "$PYTHON_BIN" -V >/dev/null 2>&1; then
    PYTHON_CMD=("$PYTHON_BIN")
    return 0
  fi

  local fallback_python
  fallback_python="$(command -v python3 || true)"
  if [[ -z "$fallback_python" ]]; then
    printf 'Error: neither %s nor python3 is available.\n' "$PYTHON_BIN" >&2
    exit 1
  fi

  local site_packages
  site_packages="$(find "$PROJECT_DIR/venv/lib" -mindepth 2 -maxdepth 2 -type d -name site-packages 2>/dev/null | head -n 1)"
  if [[ -z "$site_packages" ]]; then
    printf 'Error: could not find venv site-packages for fallback Python startup.\n' >&2
    exit 1
  fi

  if ! PYTHONPATH="$site_packages${PYTHONPATH:+:$PYTHONPATH}" "$fallback_python" -c 'import uvicorn' >/dev/null 2>&1; then
    printf 'Error: fallback python3 could not import uvicorn from %s.\n' "$site_packages" >&2
    exit 1
  fi

  PYTHON_CMD=("$fallback_python")
  export PYTHONPATH="$site_packages${PYTHONPATH:+:$PYTHONPATH}"
}

wait_for_local_server() {
  if ! check_command curl; then
    printf 'Local health check:\nskipped because curl is not installed\n\n'
    return 0
  fi

  local attempt
  for ((attempt = 1; attempt <= SERVER_START_TIMEOUT_SECONDS; attempt += 1)); do
    if curl --silent --show-error --fail --max-time 2 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
      printf 'Local health check:\nhttp://127.0.0.1:%s/api/health is responding\n\n' "$PORT"
      return 0
    fi

    sleep 1
  done

  printf 'Warning: local server did not answer health checks within %ss.\n\n' "$SERVER_START_TIMEOUT_SECONDS" >&2
  return 1
}

configure_tailscale_serve() {
  if [[ "$ENABLE_TAILSCALE_SERVE" != "1" ]]; then
    printf 'Tailscale Serve:\ndisabled\n\n'
    return 0
  fi

  if ! check_command tailscale; then
    if [[ "$TAILSCALE_SERVE_STRICT" == "1" ]]; then
      printf 'Error: tailscale command not found but ENABLE_TAILSCALE_SERVE=1.\n' >&2
      exit 1
    fi

    printf 'Warning: tailscale command not found; skipping Tailscale Serve.\n\n' >&2
    return 0
  fi

  printf 'Tailscale Serve:\nhttps on port %s -> %s\n\n' "$TAILSCALE_SERVE_PORT" "$TAILSCALE_TARGET_URL"

  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    tailscale serve --bg --yes --https="$TAILSCALE_SERVE_PORT" "$TAILSCALE_TARGET_URL"
    return 0
  fi

  if sudo -n tailscale serve --bg --yes --https="$TAILSCALE_SERVE_PORT" "$TAILSCALE_TARGET_URL"; then
    return 0
  fi

  if [[ -t 0 && -t 1 ]]; then
    printf 'Tailscale Serve needs sudo to publish the HTTPS endpoint.\n'
    printf 'You may be prompted for your password now.\n\n'

    if sudo tailscale serve --bg --yes --https="$TAILSCALE_SERVE_PORT" "$TAILSCALE_TARGET_URL"; then
      return 0
    fi
  fi

  if [[ "$TAILSCALE_SERVE_STRICT" == "1" ]]; then
    printf 'Error: could not configure Tailscale Serve automatically.\n' >&2
    printf 'Run this first, then retry:\n' >&2
    printf 'sudo tailscale serve --bg --yes --https=%s %s\n' "$TAILSCALE_SERVE_PORT" "$TAILSCALE_TARGET_URL" >&2
    exit 1
  fi

  printf 'Warning: could not configure Tailscale Serve automatically.\n' >&2
  printf 'The central server will still start locally.\n' >&2
  printf 'Run this in another terminal if you want remote access through Tailscale:\n' >&2
  printf 'sudo tailscale serve --bg --yes --https=%s %s\n\n' "$TAILSCALE_SERVE_PORT" "$TAILSCALE_TARGET_URL" >&2
}

check_ollama() {
  if ! check_command curl; then
    printf 'Ollama check:\nskipped because curl is not installed\n\n'
    return 0
  fi

  if curl --silent --show-error --fail --max-time 3 "$OLLAMA_BASE_URL/api/tags" >/dev/null; then
    printf 'Ollama:\nreachable at %s\n\n' "$OLLAMA_BASE_URL"
    return 0
  fi

  printf 'Warning: Ollama is not responding at %s\n' "$OLLAMA_BASE_URL" >&2
  printf 'The server may start, but /api/health or /api/tutor will fail until Ollama is available.\n\n' >&2
}

server_pid=""

cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" >/dev/null 2>&1; then
    kill "$server_pid" >/dev/null 2>&1 || true
  fi
}

main() {
  require_file "$PYTHON_BIN" "virtual environment Python not found at venv/bin/python"
  resolve_python_command
  export HF_HUB_DISABLE_TELEMETRY
  if [[ -n "${HF_HUB_OFFLINE:-}" ]]; then
    export HF_HUB_OFFLINE
  fi

  if [[ -n "${REMOTE_BACKEND_BASE_URL:-}" ]]; then
    printf 'Error: REMOTE_BACKEND_BASE_URL is set.\n' >&2
    printf 'server.sh is for the central server and must run with REMOTE_BACKEND_BASE_URL empty.\n' >&2
    exit 1
  fi

  check_ollama

  printf 'English AI Tutor - Central Server Mode\n\n'
  printf 'Backend:\nhttp://127.0.0.1:%s\n\n' "$PORT"
  printf 'Bind:\n%s:%s\n\n' "$HOST" "$PORT"
  printf 'Python command:\n%s\n\n' "${PYTHON_CMD[*]}"
  printf 'HF Hub offline:\n%s\n\n' "$HF_HUB_OFFLINE"
  printf 'Proxy mode:\ndisabled\n\n'
  printf 'HTTPS inside Uvicorn:\ndisabled\n\n'
  printf 'Press Ctrl+C to stop the central server.\n\n'

  trap cleanup EXIT INT TERM

  "${PYTHON_CMD[@]}" -m uvicorn "$APP_MODULE" \
    --host "$HOST" \
    --port "$PORT" &
  server_pid="$!"

  wait_for_local_server || true
  configure_tailscale_serve

  wait "$server_pid"
}

main "$@"
