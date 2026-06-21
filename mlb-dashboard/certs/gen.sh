#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
openssl req -x509 -newkey rsa:2048 -keyout "$DIR/key.pem" -out "$DIR/cert.pem" \
  -days 365 -nodes -subj "/CN=localhost/O=LocalDev"
echo "Generated $DIR/cert.pem + $DIR/key.pem"
echo ""
echo "Start HTTP:   python3 -m uvicorn main:app --host 0.0.0.0 --port 8000"
echo "Start HTTPS:  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-certfile certs/cert.pem --ssl-keyfile certs/key.pem"
