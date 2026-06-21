#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-http}"  # http or https

if [ -z "$ODDS_API_KEY" ]; then
  echo "ERROR: ODDS_API_KEY not set."
  echo "  export ODDS_API_KEY='your_key_here'"
  exit 1
fi

cd "$DIR/backend"
case "$MODE" in
  https)
    if [ ! -f "$DIR/certs/cert.pem" ]; then
      echo "Generating self-signed cert..."
      bash "$DIR/certs/gen.sh"
    fi
    exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 \
      --ssl-certfile "$DIR/certs/cert.pem" --ssl-keyfile "$DIR/certs/key.pem"
    ;;
  http|*)
    exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
    ;;
esac
