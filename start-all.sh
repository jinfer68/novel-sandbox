#!/bin/bash
# 清舊暫存
rm -f /tmp/novel-sandbox-pending.json \
       /tmp/novel-sandbox-queue.json \
       /tmp/novel-sandbox-notify.log

cd "$(dirname "$0")"

# 確保只有一個 worker 在跑
pkill -f "node scripts/claude-worker" 2>/dev/null
sleep 0.5

# 啟動 claude-worker（背景，輸出導向 log）
node scripts/claude-worker.js >> /tmp/novel-sandbox-worker.log 2>&1 &
echo "[start-all] claude-worker PID=$!"

# 啟動 Vite（前景，preview 工具監聽這個 port）
exec npm run dev
