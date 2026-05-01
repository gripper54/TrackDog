#!/bin/zsh
set -e
cd /Users/crimmit/.openclaw/workspace/trackdog

UI_LOG=/tmp/trackdog-ui.log
API_LOG=/tmp/trackdog-api.log
UI_PORT=5173

if [ ! -d node_modules ]; then
  npm install
fi

pkill -f "[v]ite --host 127.0.0.1" >/dev/null 2>&1 || true
pkill -f "[n]odemon server.js" >/dev/null 2>&1 || true
pkill -f "[n]ode server.js" >/dev/null 2>&1 || true

: > "$UI_LOG"
: > "$API_LOG"

nohup npm run dev:api > "$API_LOG" 2>&1 &
nohup npm run dev:ui -- --host 127.0.0.1 > "$UI_LOG" 2>&1 &

for _ in {1..20}; do
  sleep 1
  if curl -sf "http://127.0.0.1:${UI_PORT}" >/dev/null 2>&1 && curl -sf "http://127.0.0.1:3001/api/meta" >/dev/null 2>&1; then
    open "http://127.0.0.1:${UI_PORT}"
    exit 0
  fi
done

echo "Trackdog did not start correctly. Check: $UI_LOG and $API_LOG"
exit 1
