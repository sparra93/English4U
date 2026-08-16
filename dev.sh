#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$PROJECT_DIR/venv/bin/python"
APP_MODULE="app.main:app"
HOST="0.0.0.0"
PORT="8090"
CERT_DIR="$PROJECT_DIR/.certs"
CERT_FILE="$CERT_DIR/dev-cert.pem"
KEY_FILE="$CERT_DIR/dev-key.pem"
LOCAL_URL="https://127.0.0.1:${PORT}"
LOCALHOST_URL="https://localhost:${PORT}"

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

ensure_dev_certificate() {
  mkdir -p "$CERT_DIR"

  if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    return 0
  fi

  openssl req \
    -x509 \
    -newkey rsa:2048 \
    -nodes \
    -days 365 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" >/dev/null 2>&1
}

main() {
  require_file "$PYTHON_BIN" "virtual environment Python not found at $PYTHON_BIN"
  require_executable "$PYTHON_BIN" "virtual environment Python is not executable at $PYTHON_BIN"
  require_executable "/usr/bin/openssl" "openssl is required to generate the local HTTPS certificate"
  ensure_dev_certificate

  printf 'English AI Tutor - Development Mode\n\n'
  printf 'Backend:\n%s\n\n' "$LOCAL_URL"
  printf 'Also available at:\n%s\n\n' "$LOCALHOST_URL"
  printf 'Auto reload:\nenabled\n\n'
  printf 'HTTPS:\nenabled with local self-signed certificate\n\n'
  printf 'Reload watch:\napp/\n\n'
  printf 'Certificate files:\n%s\n%s\n\n' "$CERT_FILE" "$KEY_FILE"
  printf 'Browser note:\naccept or trust the local certificate the first time to enable microphone access.\n\n'
  printf 'React frontend (in development, app/static/ is still the production frontend):\n'
  printf 'This script only starts the backend. In another terminal, run the plain-HTTP\n'
  printf 'backend the React dev proxy expects, then start Vite:\n\n'
  printf '  %s/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload\n' "$PROJECT_DIR"
  printf '  cd %s/frontend \&\& npm install \&\& npm run dev   # http://localhost:5173\n\n' "$PROJECT_DIR"
  printf 'Press Ctrl+C to stop development server.\n\n'

  exec "$PYTHON_BIN" -m uvicorn "$APP_MODULE" \
    --host "$HOST" \
    --port "$PORT" \
    --reload \
    --reload-dir "$PROJECT_DIR/app" \
    --ssl-certfile "$CERT_FILE" \
    --ssl-keyfile "$KEY_FILE"
}

main "$@"
