/**
 * claude-worker.js
 * Polls /tmp/novel-sandbox-pending.json for engine === 'claude-code' requests,
 * calls the `claude` CLI (Claude Code), and writes the result to the queue.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'

const PENDING_FILE = '/tmp/novel-sandbox-pending.json'
const QUEUE_FILE   = '/tmp/novel-sandbox-queue.json'
const POLL_MS      = 1000
const TIMEOUT_MS   = 60000
const CLAUDE_BIN   = process.env.CLAUDE_BIN || 'claude'

let activeId = null

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value))
}
function readQueue() {
  const q = readJson(QUEUE_FILE, {})
  return (q && typeof q === 'object' && !Array.isArray(q)) ? q : {}
}

function extractJson(text) {
  const raw = text.trim()
  try { return JSON.parse(raw) } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) { try { return JSON.parse(fenced[1].trim()) } catch {} }
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
  if (s >= 0 && e > s) return JSON.parse(raw.slice(s, e + 1))
  throw new Error('No valid JSON in claude output')
}

function buildPrompt(req) {
  const lastUser = [...(req.messages || [])].reverse().find(m => m.role === 'user')
  const intervention = lastUser?.content || '繼續推進對話'

  if (intervention.includes('資深編劇顧問') || intervention.includes('情節推進建議書') || intervention.includes('情節岔路')) {
    return `${intervention}

重要規則：
- 只能輸出一個 JSON object。
- 不要輸出 Markdown、說明文字或 code fence。
- 若輸出 comics，必須剛好 3 張，每張包含 title、shot、caption、dialogue、palette、prompt。`
  }

  return `${req.systemPrompt || ''}

導演指令：${intervention}

只輸出一個 JSON object，不含任何其他文字：
{"narration":"旁白","lines":[{"char":"a","line":"台詞","emotion":"情緒"}],"decisions":[{"char":"名字","intent":"意圖","because":"原因"}],"director_effect":"","emotions":{"a":{"anger":0,"fear":0,"trust":0},"b":{"anger":0,"fear":0,"trust":0},"c":{"anger":0,"fear":0,"trust":0}}}`
}

async function runClaude(req) {
  const prompt = buildPrompt(req)

  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, [
      '--print',
      '--output-format', 'text',
      '--model', 'claude-sonnet-4-5',
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    let out = '', err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('claude timeout')) }, TIMEOUT_MS)
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('error', e => { clearTimeout(timer); reject(e) })
    child.on('close', code => {
      clearTimeout(timer)
      try { resolve(extractJson(out)) }
      catch (e) { reject(new Error(`${e.message}\nstdout: ${out.slice(0, 400)}\nstderr: ${err.slice(0, 200)}`)) }
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

async function pushResponse(id, response) {
  const queue = readQueue()
  queue[id] = response
  writeJson(QUEUE_FILE, queue)
  writeJson(PENDING_FILE, {})
}

async function tick() {
  const pending = readJson(PENDING_FILE, null)
  if (activeId || !pending?.id || pending.engine !== 'claude-code') return

  activeId = pending.id
  console.log(`[claude-worker] handling ${pending.id}`)

  try {
    const response = await runClaude(pending)
    await pushResponse(pending.id, response)
    console.log(`[claude-worker] done ${pending.id}`)
  } catch (e) {
    console.error(`[claude-worker] failed ${pending.id}:`, e.message)
    await pushResponse(pending.id, {
      narration: `生成失敗：${e.message.slice(0, 120)}`,
      lines: [{ char: 'a', line: 'Claude worker 發生錯誤，請檢查 terminal。', emotion: 'system' }],
      decisions: [],
      director_effect: '',
      emotions: { a: { anger: 0, fear: 0, trust: 0 }, b: { anger: 0, fear: 0, trust: 0 }, c: { anger: 0, fear: 0, trust: 0 } },
    })
  } finally {
    activeId = null
  }
}

console.log(`[claude-worker] watching ${PENDING_FILE} for engine=claude-code`)
setInterval(() => tick().catch(e => console.error('[claude-worker] tick error:', e.message)), POLL_MS)
