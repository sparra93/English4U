#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$PROJECT_DIR/venv/bin/python"
FRONTEND_DIR="$PROJECT_DIR/frontend"
APP_MODULE="backend.main:app"
HOST="0.0.0.0"
PORT="${APP_PORT:-8090}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
STARTUP_TIMEOUT_SECONDS="${STARTUP_TIMEOUT_SECONDS:-30}"

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
  command -v "$1" >/dev/null 2>&1
}

require_file "$PYTHON_BIN" "virtual environment Python not found at venv/bin/python"
require_executable "$PYTHON_BIN" "virtual environment Python is not executable at venv/bin/python"
require_file "$FRONTEND_DIR/package.json" "frontend/ not found — run this script from the project root"

if ! check_command npm; then
  printf 'Error: npm is required to run the React frontend but was not found on PATH.\n' >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  printf 'Installing frontend dependencies (first run only)...\n\n'
  (cd "$FRONTEND_DIR" && npm install)
fi

backend_pid=""

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" >/dev/null 2>&1; then
    printf '\nStopping backend (pid %s)...\n' "$backend_pid"
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_backend() {
  if ! check_command curl; then
    printf 'Backend health check:\nskipped because curl is not installed\n\n'
    return 0
  fi

  local attempt
  for ((attempt = 1; attempt <= STARTUP_TIMEOUT_SECONDS; attempt += 1)); do
    if curl --silent --show-error --fail --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
      printf 'Backend is up:\n%s\n\n' "$HEALTH_URL"
      return 0
    fi

    if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
      printf 'Error: the backend process exited unexpectedly. Check the output above.\n' >&2
      exit 1
    fi

    sleep 1
  done

  printf 'Warning: backend did not answer health checks within %ss. Starting the frontend anyway.\n\n' "$STARTUP_TIMEOUT_SECONDS" >&2
}

main() {
  printf 'English AI Tutor - React frontend (development)\n\n'
  printf 'Backend:\nhttp://127.0.0.1:%s (plain HTTP — required by the Vite dev proxy)\n\n' "$PORT"

  "$PYTHON_BIN" -m uvicorn "$APP_MODULE" --host "$HOST" --port "$PORT" --reload &
  backend_pid="$!"

  printf 'Waiting for backend to come up...\n'
  wait_for_backend

  printf 'Frontend:\nhttp://localhost:5173\n\n'
  printf 'Press Ctrl+C to stop both the backend and the frontend.\n\n'

  (cd "$FRONTEND_DIR" && npm run dev)
}

main "$@"
