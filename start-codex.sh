#!/bin/bash
# Novel Sandbox - Codex engine launcher
# Usage: cd /Users/wujingfu/Downloads/novel-sandbox && ./start-codex.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

PENDING_FILE="/tmp/novel-sandbox-pending.json"
QUEUE_FILE="/tmp/novel-sandbox-queue.json"
NOTIFY_LOG="/tmp/novel-sandbox-notify.log"
RUN_DIR="/tmp/novel-sandbox-runtime"
VITE_LOG="$RUN_DIR/vite.log"
WORKER_LOG="$RUN_DIR/codex-worker.log"
URL_FILE="$RUN_DIR/url.txt"

mkdir -p "$RUN_DIR"

find_stale_pids() {
  {
    ps -axo pid=,command= \
      | grep -E "($PROJECT_DIR.*node_modules/.bin/vite --host 127.0.0.1)|npm run codex-worker|node scripts/codex-worker.js|codex exec.*--cd $PROJECT_DIR" \
      | grep -v grep \
      | awk '{ print $1 }'
  } || true
}

stop_stale_processes() {
  local pids
  pids="$(find_stale_pids | tr '\n' ' ')"
  if [ -n "${pids// }" ]; then
    echo "Stopping stale Novel Sandbox processes: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(find_stale_pids | tr '\n' ' ')"
    if [ -n "${pids// }" ]; then
      echo "Force stopping stale Novel Sandbox processes: $pids"
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

rm -f /tmp/novel-sandbox-pending.json \
      /tmp/novel-sandbox-queue.json \
      /tmp/novel-sandbox-notify.log
: > "$VITE_LOG"
: > "$WORKER_LOG"
rm -f "$URL_FILE"

stop_stale_processes

printf '{}' > "$PENDING_FILE"
printf '{}' > "$QUEUE_FILE"

echo ""
echo "Novel Sandbox - Codex engine"
echo "--------------------------------"
echo "Project:       $PROJECT_DIR"
echo "Worker engine: Codex"
echo "Close:         Ctrl+C"
echo "Logs:          $VITE_LOG"
echo "               $WORKER_LOG"
echo ""

cleanup() {
  echo ""
  echo "Stopping Novel Sandbox..."
  kill "$VITE_PID" "$WORKER_PID" 2>/dev/null || true
  wait "$VITE_PID" "$WORKER_PID" 2>/dev/null || true
  echo "Stopped."
  exit 0
}
trap cleanup INT TERM

NOVEL_SANDBOX_ENGINE=local npm run dev -- --host 127.0.0.1 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

for _ in $(seq 1 40); do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "Vite failed to start. Recent log:"
    tail -40 "$VITE_LOG" || true
    exit 1
  fi

  if grep -qE 'Local:[[:space:]]+http://127\.0\.0\.1:[0-9]+/novel-sandbox/' "$VITE_LOG"; then
    grep -Eo 'http://127\.0\.0\.1:[0-9]+/novel-sandbox/' "$VITE_LOG" | tail -1 > "$URL_FILE"
    break
  fi

  sleep 0.25
done

if [ ! -s "$URL_FILE" ]; then
  echo "Vite started, but no local URL was detected. Recent log:"
  tail -40 "$VITE_LOG" || true
  cleanup
fi

NOVEL_SANDBOX_CODEX_TIMEOUT_MS="${NOVEL_SANDBOX_CODEX_TIMEOUT_MS:-120000}" npm run codex-worker > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!

sleep 1
if ! kill -0 "$WORKER_PID" 2>/dev/null; then
  echo "Codex worker failed to start. Recent log:"
  tail -40 "$WORKER_LOG" || true
  cleanup
fi

echo "Started."
echo "Vite bridge: $(cat "$URL_FILE")"
echo "Vite PID:   $VITE_PID"
echo "Worker PID: $WORKER_PID"
echo ""
echo "In the browser, choose engine 'Codex', then press the opening button."
echo ""

while true; do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "Vite stopped. Recent log:"
    tail -40 "$VITE_LOG" || true
    cleanup
  fi

  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "Codex worker stopped. Recent log:"
    tail -40 "$WORKER_LOG" || true
    cleanup
  fi

  sleep 2
done
