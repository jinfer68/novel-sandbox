import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const PENDING_FILE = '/tmp/novel-sandbox-pending.json'
const QUEUE_FILE = '/tmp/novel-sandbox-queue.json'
const LOCAL_ENGINE_ENABLED = process.env.NOVEL_SANDBOX_ENGINE === 'local'

const CHAR_IDS = ['a', 'b', 'c']

function clampEmotion(v) {
  return Math.max(0, Math.min(10, v))
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function readQueue() {
  const value = safeJsonParse(fs.readFileSync(QUEUE_FILE, 'utf8'), {})
  if (Array.isArray(value)) return {}
  if (value && (value.lines || value.summary)) return { __legacy: value }
  return value || {}
}

function writeQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue))
}

function sendJson(res, payload) {
  res.end(JSON.stringify(payload))
}

function extractCharacterNames(systemPrompt = '') {
  // Matches both legacy "角色A(name)" and current "角色N/id(name)" formats
  // Current format: 角色1/a(偵探陳修遠)、角色2/b(管家林威廉) etc.
  const allMatches = [...systemPrompt.matchAll(/角色\d+\/([a-z]+)\(([^)]+)\)/g)]
  if (allMatches.length > 0) {
    return allMatches.reduce((acc, m) => { acc[m[1]] = m[2]; return acc }, {})
  }
  // Legacy fallback: 角色A(name)
  const defaults = { a: '偵探', b: '管家', c: '繼承人' }
  const labels = { a: 'A', b: 'B', c: 'C' }
  return CHAR_IDS.reduce((acc, id) => {
    const match = systemPrompt.match(new RegExp(`角色${labels[id]}\\(([^)]+)\\)`))
    acc[id] = match?.[1] || defaults[id]
    return acc
  }, {})
}

function extractEmotions(systemPrompt = '') {
  // Try to match "角色N/id(...) ... 怒X懼Y信Z" per character line
  const lineMatches = [...systemPrompt.matchAll(/角色\d+\/([a-z]+)\([^)]+\)[^\n]*怒(\d+)懼(\d+)信(\d+)/g)]
  if (lineMatches.length > 0) {
    return lineMatches.reduce((acc, m) => {
      acc[m[1]] = { anger: Number(m[2]), fear: Number(m[3]), trust: Number(m[4]) }
      return acc
    }, {})
  }
  // Legacy: just scan for 怒X懼Y信Z in order
  const matches = [...systemPrompt.matchAll(/怒(\d+)懼(\d+)信(\d+)/g)]
  return CHAR_IDS.reduce((acc, id, index) => {
    const m = matches[index]
    acc[id] = {
      anger: Number(m?.[1] || 3),
      fear: Number(m?.[2] || 3),
      trust: Number(m?.[3] || 3),
    }
    return acc
  }, {})
}

function cleanIntervention(text = '') {
  const cleaned = text
    .replace(/^【導演介入】/, '')
    .replace(/\n.*$/s, '')
    .replace(/，?只輸出JSON。?$/, '')
    .trim()

  if (!cleaned || cleaned.includes('繼續推進對話')) return '沉默拖長，三人都開始重新估量彼此'
  return cleaned
}

function classifyEvent(event) {
  if (/停電|黑暗|腳步|陌生/.test(event)) return 'threat'
  if (/說謊|抓包|遺書|遺囑|證據/.test(event)) return 'evidence'
  if (/警笛|門外|敲門|電話/.test(event)) return 'pressure'
  if (/崩潰|哭|尖叫|失控/.test(event)) return 'breakdown'
  return 'suspicion'
}

function getRound(request) {
  const assistantTurns = request.messages?.filter(m => m.role === 'assistant').length || 0
  return assistantTurns + 1
}

function getLastAssistantText(request) {
  return [...(request.messages || [])].reverse().find(m => m.role === 'assistant')?.content || ''
}

function pick(list, round, salt = 0) {
  return list[(round + salt) % list.length]
}

function shiftEmotions(current, event, round) {
  const fearBoost = /停電|腳步|警笛|遺書|陌生|黑暗/.test(event) ? 2 : 1
  const angerBoost = /說謊|抓包|崩潰|兇手|遺囑/.test(event) ? 2 : 1
  const trustDrop = /說謊|抓包|遺書|崩潰/.test(event) ? 2 : 1

  return {
    a: {
      anger: clampEmotion(current.a.anger + angerBoost - (round % 2)),
      fear: clampEmotion(current.a.fear + (fearBoost > 1 ? 1 : 0)),
      trust: clampEmotion(current.a.trust - trustDrop),
    },
    b: {
      anger: clampEmotion(current.b.anger + (angerBoost > 1 ? 1 : 0)),
      fear: clampEmotion(current.b.fear + fearBoost),
      trust: clampEmotion(current.b.trust - Math.max(1, trustDrop - 1)),
    },
    c: {
      anger: clampEmotion(current.c.anger + angerBoost),
      fear: clampEmotion(current.c.fear + fearBoost),
      trust: clampEmotion(current.c.trust - trustDrop),
    },
  }
}

function generateStageResponse(request) {
  const names = extractCharacterNames(request.systemPrompt)
  const emotions = extractEmotions(request.systemPrompt)
  const event = cleanIntervention(request.intervention)
  const round = getRound(request)
  const kind = classifyEvent(event)
  const last = getLastAssistantText(request)
  const next = shiftEmotions(emotions, event, round)
  const continuity = last.includes('遺書') ? '那封遺書的措辭還卡在每個人喉嚨裡。' :
    last.includes('警笛') ? '遠處的警笛讓時間突然變得很薄。' :
    last.includes('停電') || last.includes('黑暗') ? '燈光恢復後，位置改變的人不只一個。' :
    '空氣裡的停頓比任何一句話都更刺耳。'

  const beats = {
    threat: {
      a: [
        `${continuity}${names.b}，你剛才先看向門，不是看向屍體。這個習慣很有意思。`,
        `黑暗只維持了幾秒，卻足夠讓一個人藏東西。${names.c}，你的手為什麼在發抖？`,
        `我不相信巧合。${event}發生前，最後靠近壁爐的人是誰？`,
      ],
      b: [
        `先生，恐懼會讓人記錯方向。若您願意，我可以逐一確認每個人的位置。`,
        `我聽見的不是腳步，是有人刻意壓低呼吸。請不要急著把它歸到我身上。`,
        `若有人趁亂移動，最慌的那位未必最無辜。這一點我想您也同意。`,
      ],
      c: [
        `我沒有碰任何東西！可是黑掉的時候，有人從我旁邊擦過去了。`,
        `${names.a}，你別只問我。${names.b}剛才太安靜了，安靜得像早就知道會發生。`,
        `如果門外真的有人，那我們不是被困住，是被留在這裡等下一件事發生。`,
      ],
    },
    evidence: {
      a: [
        `${event}不是意外，是時間點。誰先改口，誰就知道那句話會被驗證。`,
        `${names.c}，你害怕的不是謊言被拆穿，是有人會順著它找到另一件事。`,
        `證據最迷人的地方，是它不會替任何人保持禮貌。${names.b}，輪到你了。`,
      ],
      b: [
        `我承認有些細節我沒有立刻說明，但隱瞞與犯罪之間仍有距離。`,
        `一份證詞若被情緒污染，就不該被當成真相。尤其是現在。`,
        `您可以懷疑我，但請也懷疑那個最急著把故事說完的人。`,
      ],
      c: [
        `我只是改過一句話，不代表我殺了人！你們不要把所有事都推給我。`,
        `那不是我想藏的證據。至少，不是你們以為的那一種。`,
        `如果我現在說出來，你們會更恨我。但不說，下一個倒下的可能就是我。`,
      ],
    },
    pressure: {
      a: [
        `警笛聲會讓真正有罪的人急著收尾。現在開始，誰都不要離開這個房間。`,
        `外面的人越近，裡面的謊就越快變形。${names.b}，你的鎮定快用完了。`,
        `時間不站在我們這邊，所以我只問一次：兇器最後一次出現在哪裡？`,
      ],
      b: [
        `若警方抵達前我們先互相撕碎，兇手反而會得到最好的遮掩。`,
        `我會開門，但在那之前，請各位不要碰桌上的任何東西。`,
        `聲音從遠處來，恐慌卻從這個房間裡開始。這才是危險。`,
      ],
      c: [
        `他們來了是不是就會查我的房間？不，不行，我還沒準備好。`,
        `我不想再等了。有人現在說實話，至少還能選擇怎麼被記住。`,
        `如果警察進來看到那些東西，我就完了。可是兇手不是我。`,
      ],
    },
    breakdown: {
      a: [
        `崩潰有時候是真相的門縫。別安慰他，讓他把下一句說完。`,
        `${names.c}，看著我。你不是怕死人，你是怕活著的人。是哪一個？`,
        `情緒失控不會讓人有罪，但會讓人忘記自己原本要藏什麼。`,
      ],
      b: [
        `請冷靜。再多一點失控，這裡就不會剩下能相信的證詞了。`,
        `我服侍這個家太久，久到分得出悲傷和表演。剛才那個不是悲傷。`,
        `若您需要水，我可以倒。但若您需要藉口，恐怕我幫不上忙。`,
      ],
      c: [
        `我受不了了！每個人都說自己無辜，可每個人都在等別人先死。`,
        `你們以為我什麼都不知道？我聽見過爭吵，也看見過那瓶藥。`,
        `別再叫我冷靜。冷靜的人才最可怕，因為他們早就想好了退路。`,
      ],
    },
    suspicion: {
      a: [
        `${continuity}現在沒有人新增證據，只有舊謊言開始互相咬住。`,
        `${names.b}太懂這棟房子，${names.c}太怕這棟房子。兇手就在這兩種恐懼中間。`,
        `我們先別談誰殺了人。談談誰最希望死者今晚閉嘴。`,
      ],
      b: [
        `沉默並不代表無話可說，有時只是比說錯話更明智。`,
        `這棟房子保存秘密的方式很簡單：每個人只承認對自己有利的部分。`,
        `若您要找動機，請別只看仇恨。繼承、羞恥、舊情，都足夠致命。`,
      ],
      c: [
        `你們說得越慢，我越覺得你們早就知道答案，只是不敢講。`,
        `${names.a}，你跟死者到底是什麼關係？你看他的眼神不像陌生人。`,
        `我不想再被當成小孩。這裡每個人的秘密都比我的更髒。`,
      ],
    },
  }

  const set = beats[kind]

  return {
    lines: [
      {
        char: 'a',
        line: pick(set.a, round, 0),
        emotion: next.a.trust <= 2 ? '戒備' : '冷靜試探',
      },
      {
        char: 'b',
        line: pick(set.b, round, 1),
        emotion: next.b.fear >= 8 ? '強作鎮定' : '禮貌防衛',
      },
      {
        char: 'c',
        line: pick(set.c, round, 2),
        emotion: next.c.anger >= 8 ? '失控' : '驚懼',
      },
    ],
    emotions: next,
  }
}

function extractReportNames(prompt = '') {
  const matches = [...prompt.matchAll(/角色[A-C]\(([^)]+)\)/g)]
  return {
    a: matches[0]?.[1] || '角色A',
    b: matches[1]?.[1] || '角色B',
    c: matches[2]?.[1] || '角色C',
  }
}

function generateReportResponse(request) {
  const prompt = request.messages?.at(-1)?.content || ''
  const names = extractReportNames(prompt)
  return {
    summary: '這場戲的張力集中在互相試探與秘密逐步外露。每一次外部事件都讓三人更難維持原本的偽裝，信任快速下降。當恐懼與憤怒同時升高，真正的衝突已經從查案轉向自保。',
    arcs: [
      { char: names.a, arc: '從冷靜旁觀者變成被迫承認自己也涉入過去的人。' },
      { char: names.b, arc: '從掌控秩序的僕人滑向無法完全掩飾恐懼的嫌疑核心。' },
      { char: names.c, arc: '從情緒化的繼承人變成握有關鍵線索卻不敢說出口的人。' },
    ],
    paths: [
      { label: '假證詞反咬', desc: '有人提出不完整證據，反而暴露更大的謊。' },
      { label: '秘密交換', desc: '兩名角色私下結盟，各自隱瞞真正代價。' },
      { label: '兇器回歸', desc: '消失的物件重新出現，但位置不可能成立。' },
    ],
    tension: `${names.b}的禮貌開始破裂，而${names.a}與${names.c}都察覺他知道得太多。`,
  }
}

function generateLocalResponse(request) {
  const lastMessage = request.messages?.at(-1)?.content || ''
  if (lastMessage.includes('資深編劇顧問') || lastMessage.includes('情節岔路')) {
    return generateReportResponse(request)
  }
  return generateStageResponse(request)
}

function bridgePlugin() {
  return {
    name: 'novel-sandbox-bridge',
    configureServer(server) {
      fs.writeFileSync(PENDING_FILE, '{}')
      fs.writeFileSync(QUEUE_FILE, '[]')

      // browser → signals it's waiting with intervention text
      server.middlewares.use('/api/bridge/pending', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'POST') {
          let body = ''
          req.on('data', d => body += d)
          req.on('end', () => {
            const parsed = safeJsonParse(body, null)
            // empty body = new game start → clear stale queue and pending
            if (!parsed || !parsed.id) {
              fs.writeFileSync(PENDING_FILE, '{}')
              fs.writeFileSync(QUEUE_FILE, '{}')
            } else {
              fs.writeFileSync(PENDING_FILE, body)
              // append to a separate notify log so external watchers can tail -f
              fs.appendFileSync('/tmp/novel-sandbox-notify.log', parsed.id + '\n')
            }
            res.end('ok')
          })
        } else {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(PENDING_FILE, 'utf8'))
        }
      })

      // Claude Code → pushes generated dialogue
      server.middlewares.use('/api/bridge/push', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'POST') {
          let body = ''
          req.on('data', d => body += d)
          req.on('end', () => {
            const payload = safeJsonParse(body, null)
            const pending = safeJsonParse(fs.readFileSync(PENDING_FILE, 'utf8'), null)
            const id = payload?.id || pending?.id || '__legacy'
            const response = payload?.response || payload
            const queue = readQueue()
            queue[id] = response
            writeQueue(queue)
            fs.writeFileSync(PENDING_FILE, '{}')
            res.end('ok')
          })
        } else {
          res.writeHead(405); res.end()
        }
      })

      // browser → polls for generated content
      server.middlewares.use('/api/bridge/queue', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        try {
          const url = new URL(req.url || '', 'http://localhost')
          const id = url.searchParams.get('id') || '__legacy'
          const queue = readQueue()
          const payload = queue[id] || (!url.searchParams.has('id') ? queue.__legacy : null)
          if (payload && (payload.lines || payload.summary)) {
            delete queue[id]
            if (id === '__legacy') delete queue.__legacy
            writeQueue(queue)
            sendJson(res, payload)
            return
          }

          const pending = safeJsonParse(fs.readFileSync(PENDING_FILE, 'utf8'), null)
          if (pending?.id === id && (pending.engine === 'local' || (LOCAL_ENGINE_ENABLED && !pending.engine))) {
            const generated = generateLocalResponse(pending)
            fs.writeFileSync(PENDING_FILE, '{}')
            sendJson(res, generated)
            return
          }

          res.writeHead(204); res.end()
        } catch {
          res.writeHead(204); res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), bridgePlugin()],
  server: {
    port: 3000,
  },
})
