#!/bin/bash
# ──────────────────────────────────────────────────────
# 靈感培養皿 — Claude 引擎一鍵啟動
# 用法：cd ~/Downloads/novel-sandbox && ./start-claude.sh
# 關閉：在這個視窗按 Ctrl+C
# ──────────────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 清暫存
rm -f /tmp/novel-sandbox-pending.json \
       /tmp/novel-sandbox-queue.json \
       /tmp/novel-sandbox-notify.log

echo ""
echo "🎭  靈感培養皿 — Claude 引擎"
echo "──────────────────────────────"
echo "▸  Vite bridge server + claude-worker 同時啟動"
echo "▸  瀏覽器請連 http://localhost:3003"
echo "▸  關閉請按 Ctrl+C"
echo ""

# 同時跑 vite dev + claude-worker，Ctrl+C 一次全部結束
cleanup() {
  echo ""
  echo "🛑  關閉中..."
  kill "$VITE_PID" "$WORKER_PID" 2>/dev/null
  wait "$VITE_PID" "$WORKER_PID" 2>/dev/null
  echo "✅  已結束"
  exit 0
}
trap cleanup INT TERM

# 啟動 Vite（背景）
npm run dev &
VITE_PID=$!

# 等 Vite 準備好再開 worker
sleep 2

# 啟動 claude-worker（背景）
node scripts/claude-worker.js &
WORKER_PID=$!

echo "✅  全部啟動完成"
echo "   PID Vite:   $VITE_PID"
echo "   PID Worker: $WORKER_PID"
echo ""

# 等待，直到 Ctrl+C
wait
