import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PENDING_FILE = '/tmp/novel-sandbox-pending.json'
const QUEUE_FILE = '/tmp/novel-sandbox-queue.json'
const POLL_MS = Number(process.env.NOVEL_SANDBOX_CODEX_POLL_MS || 1000)
const CODEX_TIMEOUT_MS = Number(process.env.NOVEL_SANDBOX_CODEX_TIMEOUT_MS || 30000)
const CODEX_BIN = process.env.CODEX_BIN || 'codex'
const CODEX_MODEL = process.env.CODEX_MODEL || 'gpt-5.4-mini'
const ROOT = process.cwd()

let activeId = null

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value))
}

function readQueue() {
  const queue = readJson(QUEUE_FILE, {})
  if (Array.isArray(queue)) return {}
  if (queue && (queue.lines || queue.summary)) return { __legacy: queue }
  return queue || {}
}

function extractJson(text) {
  const raw = text.trim()

  const agentMessages = raw
    .split(/\r?\n/)
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(event => event?.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text)

  if (agentMessages.length > 0) {
    return extractJson(agentMessages.at(-1).item.text)
  }

  try {
    return JSON.parse(raw)
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {}
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1))
  }

  throw new Error('Codex output did not contain valid JSON')
}

function extractStageCharIds(systemPrompt = '') {
  const ids = [...systemPrompt.matchAll(/角色\d+\/([a-z])\(/g)].map(match => match[1])
  return ids.length ? [...new Set(ids)] : ['a', 'b', 'c']
}

function buildStageJsonExample(systemPrompt = '') {
  const ids = extractStageCharIds(systemPrompt)
  return JSON.stringify({
    lines: ids.map(id => ({ char: id, line: '台詞', emotion: '情緒標籤' })),
    emotions: Object.fromEntries(ids.map(id => [id, { anger: 0, fear: 0, trust: 0 }])),
  })
}

function buildPrompt(request) {
  const messagesText = (request.messages || [])
    .slice(-6)
    .map(m => `${m.role.toUpperCase()}:\n${m.content}`)
    .join('\n\n')
  const stageJsonExample = buildStageJsonExample(request.systemPrompt || '')

  return `你是這個本地互動小說沙盒的 Codex 生成 worker。

請根據 system prompt 與對話歷史，為這一輪產生結果。

重要規則：
- 只能輸出一個 JSON object。
- 不要輸出 Markdown、說明文字或 code fence。
- 若是舞台對話，格式必須是：
${stageJsonExample}
- 若是情節建議書，格式必須是：
{"summary":"...","prose":"...","arcs":[{"char":"...","arc":"..."}],"usable_lines":["..."],"paths":[{"label":"...","desc":"..."}],"tension":"...","comics":[{"title":"...","shot":"...","caption":"...","dialogue":"...","palette":"...","prompt":"..."}]}
- 情節建議書的 comics 必須剛好 3 張，根據已發生劇情做連續漫畫畫格，不要只是重述三條岔路。
- 情緒值必須是 0 到 10 的整數。
- 不要呼叫工具，不要讀寫檔案，只產生 JSON。

REQUEST ID:
${request.id}

SYSTEM PROMPT:
${request.systemPrompt || '(none)'}

MESSAGES:
${messagesText}
`
}

async function runCodex(request) {
  const outputPath = path.join(os.tmpdir(), `novel-sandbox-codex-${request.id}.json`)
  const prompt = buildPrompt(request)

  const { stdout, stderr } = await new Promise((resolve, reject) => {
    const child = spawn(CODEX_BIN, [
      'exec',
      '--json',
      '-m', CODEX_MODEL,
      '--cd', ROOT,
      '--sandbox', 'read-only',
      '--ephemeral',
      '--output-last-message', outputPath,
      '-',
    ], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Codex timed out after ${CODEX_TIMEOUT_MS}ms`))
    }, CODEX_TIMEOUT_MS)

    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code !== 0 && !stdout && !stderr) {
        reject(new Error(`Codex exited with code ${code}`))
        return
      }
      resolve({ stdout, stderr })
    })

    child.stdin.write(prompt)
    child.stdin.end()
  })

  const output = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : `${stdout}\n${stderr}`
  fs.rmSync(outputPath, { force: true })
  try {
    return extractJson(output)
  } catch (error) {
    const debugPath = path.join(os.tmpdir(), `novel-sandbox-codex-${request.id}.stdout.log`)
    fs.writeFileSync(debugPath, output)
    throw new Error(`${error.message}; raw output saved to ${debugPath}`)
  }
}

async function pushResponse(id, response) {
  const queue = readQueue()
  queue[id] = response
  writeJson(QUEUE_FILE, queue)
  writeJson(PENDING_FILE, {})
}

async function tick() {
  const pending = readJson(PENDING_FILE, null)
  if (activeId || !pending?.id || pending.engine !== 'codex') return

  activeId = pending.id
  console.log(`[codex-worker] handling ${pending.id}`)

  try {
    const response = await runCodex(pending)
    await pushResponse(pending.id, response)
    console.log(`[codex-worker] pushed ${pending.id}`)
  } catch (error) {
    console.error(`[codex-worker] failed ${pending.id}:`, error.message)
    await pushResponse(pending.id, {
      lines: [
        { char: 'a', line: `Codex worker 生成失敗：${error.message}`, emotion: 'system' },
      ],
      emotions: {
        a: { anger: 0, fear: 0, trust: 0 },
        b: { anger: 0, fear: 0, trust: 0 },
        c: { anger: 0, fear: 0, trust: 0 },
      },
    })
  } finally {
    activeId = null
  }
}

console.log(`[codex-worker] watching ${PENDING_FILE}`)
setInterval(() => {
  tick().catch(error => console.error('[codex-worker] tick failed:', error.message))
}, POLL_MS)
