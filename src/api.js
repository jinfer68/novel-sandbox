/**
 * Claude Code direct-drive mode via Vite bridge API.
 * callClaude() signals /api/bridge/pending and polls /api/bridge/queue.
 * Claude Code monitors /tmp/novel-sandbox-pending.json and pushes via /api/bridge/push.
 *
 * When engine === 'local', responses are generated entirely in-browser
 * (no server needed — works on GitHub Pages / static hosting).
 */

// ─── Local engine: pure browser rule-based generation ────────────────────────

function extractCharIds(systemPrompt) {
  const matches = [...systemPrompt.matchAll(/角色\d+\/([a-z])\(/g)]
  return matches.map(m => m[1])
}

function extractCharName(systemPrompt, id) {
  const m = systemPrompt.match(new RegExp(`角色\\d+\\/${id}\\(([^)]+)\\)`))
  return m ? m[1] : id
}

function extractEmotions(systemPrompt) {
  const emMap = {}
  const blocks = [...systemPrompt.matchAll(/角色\d+\/([a-z])\([^)]+\)[^；]*；情緒怒(\d+)懼(\d+)信(\d+)/g)]
  for (const [, id, anger, fear, trust] of blocks) {
    emMap[id] = { anger: +anger, fear: +fear, trust: +trust }
  }
  return emMap
}

const NARRATIONS = [
  '沉默在房間裡蔓延，空氣因緊繃而凝固。',
  '燭火搖曳，三人的目光在黑暗中交錯、閃避。',
  '某人的手輕輕握緊，又慢慢放開。',
  '窗外的風聲穿過縫隙，像是有什麼東西正在逼近。',
  '時間以一種奇怪的方式緩慢流動，每一秒都帶著重量。',
  '沒有人說話，但每個人都在聽。',
  '燈光在某個瞬間閃了一下，然後恢復平靜。',
]

const LINE_POOL = {
  high_anger: [
    '你以為我不知道你在想什麼？',
    '夠了，別再演了。',
    '你每一句話都是謊言。',
    '我不打算再等了。',
  ],
  high_fear: [
    '……我、我不知道你在說什麼。',
    '請不要這樣看著我。',
    '這跟我無關，真的。',
    '你們搞錯了。',
  ],
  low_trust: [
    '你憑什麼要我相信你？',
    '你說的每一件事我都要重新想一遍。',
    '也許你才是最該被懷疑的人。',
  ],
  neutral: [
    '我們現在需要的是事實，不是猜測。',
    '先冷靜，把事情說清楚。',
    '這個問題值得好好想一想。',
    '有些事情我需要再確認一下。',
  ],
  director_reaction: [
    '等等——剛才那是什麼？',
    '所有人都先別動。',
    '……這不在我的預料之中。',
    '好，情況變了。',
  ],
}

function pickLine(em, hasIntervention) {
  if (hasIntervention) return pick(LINE_POOL.director_reaction)
  if (em.anger >= 7) return pick(LINE_POOL.high_anger)
  if (em.fear >= 7) return pick(LINE_POOL.high_fear)
  if (em.trust <= 2) return pick(LINE_POOL.low_trust)
  return pick(LINE_POOL.neutral)
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function emotionLabel(em) {
  if (em.anger >= 7) return '憤怒'
  if (em.fear >= 7) return '恐懼'
  if (em.trust <= 2) return '懷疑'
  if (em.fear >= 5) return '緊張'
  if (em.anger >= 4) return '不滿'
  return '冷靜'
}

function clamp(v) { return Math.max(0, Math.min(10, v)) }

function generateLocal(systemPrompt, intervention) {
  const ids = extractCharIds(systemPrompt)
  const curEmotions = extractEmotions(systemPrompt)
  const hasIntervention = intervention && !intervention.includes('繼續推進')

  // Pick 1–2 speakers
  const speakerCount = Math.random() < 0.4 ? 1 : (Math.random() < 0.6 ? 2 : Math.min(3, ids.length))
  const shuffled = [...ids].sort(() => Math.random() - 0.5)
  const speakers = shuffled.slice(0, speakerCount)

  const lines = speakers.map(id => {
    const em = curEmotions[id] || { anger: 3, fear: 3, trust: 5 }
    return { char: id, line: pickLine(em, hasIntervention), emotion: emotionLabel(em) }
  })

  // Update emotions slightly
  const newEmotions = {}
  for (const id of ids) {
    const em = curEmotions[id] || { anger: 3, fear: 3, trust: 5 }
    const delta = () => (Math.random() < 0.5 ? 1 : -1) * (Math.random() < 0.3 ? 2 : 1)
    newEmotions[id] = {
      anger: clamp(em.anger + (hasIntervention ? 1 : delta())),
      fear:  clamp(em.fear  + (hasIntervention ? 1 : delta())),
      trust: clamp(em.trust + (hasIntervention ? -1 : delta())),
    }
  }

  const decisions = speakers.map(id => ({
    char: extractCharName(systemPrompt, id),
    intent: '依角色設定行動',
    because: '本地規則引擎模擬',
  }))

  return {
    narration: hasIntervention
      ? `【${intervention}】${pick(NARRATIONS)}`
      : pick(NARRATIONS),
    lines,
    decisions,
    director_effect: hasIntervention ? `導演事件「${intervention}」已觸發，角色即時反應。` : '',
    emotions: newEmotions,
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function callClaude(messages, systemPrompt = '', options = {}) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const intervention = lastUser?.content || '繼續推進對話'
  const engine = options.engine || 'claude-code'

  // Local engine: fully in-browser, no server needed
  if (engine === 'local') {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400)) // fake latency
    const payload = generateLocal(systemPrompt, intervention)
    return { parsed: payload, raw: JSON.stringify(payload) }
  }

  // Bridge-based engines (claude-code, codex): require dev server
  const id = crypto.randomUUID()

  await fetch('/api/bridge/pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, engine, intervention, systemPrompt, messages, ts: Date.now() }),
  })

  const start = Date.now()
  while (Date.now() - start < 300000) {
    await new Promise(r => setTimeout(r, 500))
    const res = await fetch(`/api/bridge/queue?id=${encodeURIComponent(id)}`)
    if (res.status === 200) {
      const payload = await res.json()
      return { parsed: payload, raw: JSON.stringify(payload) }
    }
  }
  throw new Error(`等待 ${engine} 回應逾時`)
}
