#!/bin/sh
set -eu

cd "$(dirname "$0")"
PORT="${PORT:-8000}"

LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [ -n "$LAN_IP" ]; then
  printf 'DAYTONAA is available at http://%s:%s\n' "$LAN_IP" "$PORT"
else
  printf 'Server will listen on your network. Find this computer’s LAN IP, then open http://<LAN-IP>:%s\n' "$PORT"
fi
printf 'Press Ctrl+C to stop. Keep this terminal window open.\n'
exec python3 -m http.server "$PORT" --bind 0.0.0.0
