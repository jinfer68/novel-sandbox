/**
 * Claude Code direct-drive mode via Vite bridge API.
 * callClaude() signals /api/bridge/pending and polls /api/bridge/queue.
 * Claude Code monitors /tmp/novel-sandbox-pending.json and pushes via /api/bridge/push.
 */

export function hasApiKey() { return true }
export function saveApiKey() {}

export async function callClaude(messages, _systemPrompt) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const intervention = lastUser?.content || '繼續推進對話'

  // signal Claude Code that a round is needed
  await fetch('/api/bridge/pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervention, ts: Date.now() }),
  })

  // poll for response (every 500ms, up to 5 minutes)
  const start = Date.now()
  while (Date.now() - start < 300000) {
    await new Promise(r => setTimeout(r, 500))
    const res = await fetch('/api/bridge/queue')
    if (res.status === 200) {
      const payload = await res.json()
      return { parsed: payload, raw: JSON.stringify(payload) }
    }
  }
  throw new Error('等待 Claude Code 回應逾時')
}
