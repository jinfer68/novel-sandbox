/**
 * Claude Code direct-drive mode via Vite bridge API.
 * callClaude() signals /api/bridge/pending and polls /api/bridge/queue.
 *
 * When engine === 'local', responses are generated entirely in-browser
 * (no server needed — works on GitHub Pages / static hosting).
 *
 * Local engine features a fully scripted murder mystery story arc
 * with director intervention responses baked in.
 */

// ─── Local engine: scripted story arc ────────────────────────────────────────

// Round counter persists across calls within the same session
let _localRound = 0

// Detect if the default murder mystery characters are in use
function isDefaultStory(systemPrompt) {
  return systemPrompt.includes('林威廉') && systemPrompt.includes('蘇艾倫') && systemPrompt.includes('陳修遠')
}

function extractCharIds(systemPrompt) {
  const matches = [...systemPrompt.matchAll(/角色\d+\/([a-z])\(/g)]
  return matches.length ? matches.map(m => m[1]) : ['a', 'b', 'c']
}

function extractEmotions(systemPrompt) {
  const emMap = {}
  for (const [, id, anger, fear, trust] of systemPrompt.matchAll(/角色\d+\/([a-z])\([^)]+\)[^；]*；情緒怒(\d+)懼(\d+)信(\d+)/g)) {
    emMap[id] = { anger: +anger, fear: +fear, trust: +trust }
  }
  return emMap
}

function clamp(v) { return Math.max(0, Math.min(10, v)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ── 預設謀殺案腳本 ──────────────────────────────────────────────────────────

const STORY_BEATS = [
  // Round 0 — 開場：緊張的初次對峙
  {
    narration: '三人站在書房的不同角落。壁爐的火已滅，只剩灰燼。死者的血跡在地毯上幹成深褐色，沒有人敢靠近那個位置。',
    lines: [
      { char: 'a', line: '先說清楚一件事：在警察到來之前，沒有人可以離開這棟房子。', emotion: '冷靜' },
      { char: 'b', line: '偵探先生說得極是。我已命人鎖上所有出口，這是對老爺最起碼的尊重。', emotion: '過度禮貌' },
      { char: 'c', line: '你們為什麼要看著我？我什麼都沒做！', emotion: '驚慌' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '建立控制權，觀察每個人的第一反應', because: '初始接觸最能看出心理狀態' },
      { char: '管家林威廉', intent: '搶先表現配合，建立無辜形象', because: '控制現場對他有利' },
      { char: '繼承人蘇艾倫', intent: '情緒失控，暴露不安', because: '秘密讓她無法冷靜' },
    ],
    emotions: { a: { anger: 3, fear: 1, trust: 3 }, b: { anger: 1, fear: 6, trust: 5 }, c: { anger: 5, fear: 8, trust: 2 } },
  },

  // Round 1 — 升溫：細節開始對不上
  {
    narration: '陳修遠在房間裡慢慢踱步，目光掃過每一個人的手。林威廉始終保持著精準的距離——不遠不近，像是站在一個預先計算好的位置。',
    lines: [
      { char: 'a', line: '林先生，你說你最後一次見到死者是晚上九點。但廚娘說她十點還聽到書房有兩個人說話。', emotion: '試探' },
      { char: 'b', line: '廚娘年紀大了，耳力不好。那時我已在地下室清點酒窖，帳本上有記錄。', emotion: '從容' },
      { char: 'c', line: '（小聲）帳本……他一直在說帳本……', emotion: '若有所思' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '用矛盾資訊逼出林威廉的漏洞', because: '時間線對不上是突破口' },
      { char: '管家林威廉', intent: '用不可查驗的證人反駁，同時轉移焦點', because: '必須維持不在場證明' },
      { char: '繼承人蘇艾倫', intent: '帳本讓她想起自己改遺囑的事', because: '心虛讓她對某些詞特別敏感' },
    ],
    emotions: { a: { anger: 3, fear: 1, trust: 3 }, b: { anger: 2, fear: 7, trust: 4 }, c: { anger: 5, fear: 9, trust: 1 } },
  },

  // Round 2 — 蘇艾倫的破綻
  {
    narration: '蘇艾倫的手一直在顫抖。她試圖靠近窗邊，像是想確認外面是否還有逃路。窗外是大雪，什麼都沒有。',
    lines: [
      { char: 'a', line: '蘇小姐，遺囑的事——你知道我指的是什麼。', emotion: '銳利' },
      { char: 'c', line: '我不知道你在說什麼！那份遺囑是叔叔自己的意思！', emotion: '崩潰邊緣' },
      { char: 'b', line: '（輕咳）也許蘇小姐需要一杯熱茶。偵探先生，何必逼得這麼緊？', emotion: '假意維護' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '直接點破遺囑議題，觀察她的崩潰程度', because: '她的反應已經說明一切' },
      { char: '繼承人蘇艾倫', intent: '下意識否認，但反應過激反而露出破綻', because: '被點名讓她失去控制' },
      { char: '管家林威廉', intent: '趁機護著蘇艾倫，讓她欠他人情，同時顯示自己「善良」', because: '讓兩人互相牽制對他有利' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 2, fear: 7, trust: 4 }, c: { anger: 7, fear: 10, trust: 1 } },
  },

  // Round 3 — 林威廉的裂縫
  {
    narration: '氣溫繼續下降。林威廉不再像最初那樣筆直站立，他的手悄悄握住了椅背。這是今晚第一次，他的姿態出現了破綻。',
    lines: [
      { char: 'a', line: '林先生服侍老爺三十年。三十年，一個人可以累積很多恨意。', emotion: '緩慢，每字清晰' },
      { char: 'b', line: '（停頓三秒）我不知道偵探先生這話是什麼意思。', emotion: '第一次失去從容' },
      { char: 'c', line: '他的手在抖。我看到了，他的手在抖。', emotion: '幾乎是在自言自語' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '攻擊動機而非不在場，讓林威廉心理防線鬆動', because: '不在場可以偽造，但恨意無法假裝不存在' },
      { char: '管家林威廉', intent: '第一次真正動搖，停頓暴露了他', because: '被點中要害讓他短暫失去計算能力' },
      { char: '繼承人蘇艾倫', intent: '觀察林威廉的破綻，開始懷疑他', because: '她的恐懼從「被懷疑」轉向「我旁邊站著兇手」' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 4, fear: 8, trust: 3 }, c: { anger: 6, fear: 9, trust: 1 } },
  },

  // Round 4 — 高潮：真相逼近
  {
    narration: '陳修遠從口袋裡取出一個小物件，放在桌上——是一枚領帶別針，金色，上面刻著字。林威廉的臉在那一刻失去了所有顏色。',
    lines: [
      { char: 'a', line: '這枚別針在死者手裡找到的。林先生，這是您的吧？', emotion: '平靜，卻像刀刃' },
      { char: 'b', line: '這……這不可能。我的別針一直……（沉默）', emotion: '崩潰' },
      { char: 'c', line: '天啊。（退後一步）天啊，原來是你。', emotion: '恐懼與恍悟並存' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '亮出關鍵物證，一舉擊潰林威廉的防線', because: '時機成熟，繼續等待只會讓對方重新整頓' },
      { char: '管家林威廉', intent: '防線徹底崩潰，第一次在語言上失去控制', because: '物證是無法用語言消解的' },
      { char: '繼承人蘇艾倫', intent: '恐懼的性質改變，她意識到自己一直和兇手站在同一個房間', because: '這比被懷疑更可怕' },
    ],
    emotions: { a: { anger: 5, fear: 1, trust: 3 }, b: { anger: 6, fear: 10, trust: 1 }, c: { anger: 5, fear: 10, trust: 2 } },
  },

  // Round 5 — 尾聲：餘震
  {
    narration: '沉默持續了很長時間。壁爐的灰燼裡有火星短暫閃了一下，然後熄滅。外面的雪沒有停的意思。',
    lines: [
      { char: 'b', line: '（極輕聲）我服侍他三十年。三十年，他從未說過一句謝謝。', emotion: '空洞' },
      { char: 'a', line: '我知道。但這不是你殺他的理由。', emotion: '平靜，卻帶著某種疲憊' },
      { char: 'c', line: '（坐下，雙手捂臉）這一切……什麼時候才會結束？', emotion: '精疲力竭' },
    ],
    decisions: [
      { char: '管家林威廉', intent: '第一次說出真心話——三十年的恨意比案子更真實', because: '防線崩潰後，反而能說出一直壓抑的東西' },
      { char: '偵探陳修遠', intent: '不追打，讓對方自己說完', because: '有些真相需要安靜才能浮現' },
      { char: '繼承人蘇艾倫', intent: '精神耗盡，連自保的力氣都沒了', because: '一整夜的恐懼在這一刻完全釋放' },
    ],
    emotions: { a: { anger: 3, fear: 2, trust: 4 }, b: { anger: 3, fear: 8, trust: 2 }, c: { anger: 3, fear: 7, trust: 3 } },
  },
]

// 循環尾聲後的素材（Round 6+）
const EPILOGUE_BEATS = [
  {
    narration: '窗外傳來車聲——警察終於到了。三個人都沒有移動，像是這個消息已經不再重要。',
    lines: [
      { char: 'a', line: '我需要你們今晚都留下來配合筆錄。', emotion: '職業性的疲憊' },
      { char: 'b', line: '（點頭，沒有說話）', emotion: '認命' },
      { char: 'c', line: '……我能打電話給我的律師嗎？', emotion: '小聲' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '進入收尾程序，但內心仍未平靜', because: '案子結束了，但關於死者的秘密還沒說完' },
      { char: '管家林威廉', intent: '接受結局', because: '三十年的對抗結束了' },
      { char: '繼承人蘇艾倫', intent: '立刻想到自保', because: '遺囑的事還要面對' },
    ],
    emotions: { a: { anger: 2, fear: 2, trust: 5 }, b: { anger: 2, fear: 6, trust: 3 }, c: { anger: 4, fear: 6, trust: 3 } },
  },
  {
    narration: '林威廉被帶走的時候，蘇艾倫一直看著窗外。陳修遠站在書桌旁，手指輕輕碰了一下死者的照片，然後放開。',
    lines: [
      { char: 'c', line: '你……你認識她很久了，對嗎？（停頓）她跟我說過你。', emotion: '第一次真正的平靜' },
      { char: 'a', line: '（長久的沉默）我知道。', emotion: '非常輕' },
    ],
    decisions: [
      { char: '繼承人蘇艾倫', intent: '第一次對陳修遠說一句真話', because: '危機過去後，虛偽變得沒有意義' },
      { char: '偵探陳修遠', intent: '承認一件一直沒說出口的事', because: '案子結束了，他終於可以只是一個人，不是偵探' },
    ],
    emotions: { a: { anger: 1, fear: 3, trust: 6 }, b: { anger: 0, fear: 5, trust: 4 }, c: { anger: 2, fear: 4, trust: 6 } },
  },
]

// ── 導演介入對應腳本 ────────────────────────────────────────────────────────

const DIRECTOR_RESPONSES = {
  '突然停電': {
    narration: '燈光在一聲悶響後全部熄滅。黑暗像布幕一樣落下，三個人誰都沒有動，誰都不敢動。',
    lines: [
      { char: 'a', line: '（沉聲）誰都不准移動。', emotion: '警覺' },
      { char: 'b', line: '（在黑暗中）保險絲應該在地下室……我去——', emotion: '試圖離開' },
      { char: 'c', line: '不要讓他走！別讓他一個人去！', emotion: '尖叫' },
    ],
    emotions: { a: { anger: 5, fear: 3, trust: 2 }, b: { anger: 3, fear: 9, trust: 2 }, c: { anger: 6, fear: 10, trust: 1 } },
  },
  '其中一人說謊': {
    narration: '陳修遠停下腳步，把剛才聽到的話在腦海裡重放了一遍。有什麼地方不對——像拼圖裡一塊被強迫塞進去的碎片。',
    lines: [
      { char: 'a', line: '等等。你剛才說「九點半離開」——但你一分鐘前說的是「九點」。', emotion: '銳利' },
      { char: 'b', line: '我……我說錯了。是九點半，那天我記不太清楚。', emotion: '強行鎮定' },
      { char: 'c', line: '（倒抽一口氣）他說謊了。他一直在說謊。', emotion: '驚恐' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 2 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 7, fear: 9, trust: 1 } },
  },
  '門外傳來陌生腳步聲': {
    narration: '走廊上傳來腳步聲，緩慢而有節奏，在門口停下了。三個人同時轉頭——但門，沒有打開。',
    lines: [
      { char: 'c', line: '有人在外面。有人在聽我們說話。', emotion: '顫抖' },
      { char: 'a', line: '（走向門口）誰在那裡？', emotion: '冷靜但戒備' },
      { char: 'b', line: '（沒有移動，目光卻飄向另一個方向）……也許是老宅的聲音，這棟房子很老了。', emotion: '刻意平靜' },
    ],
    emotions: { a: { anger: 4, fear: 3, trust: 2 }, b: { anger: 3, fear: 8, trust: 3 }, c: { anger: 5, fear: 10, trust: 1 } },
  },
  '有人發現密室中的遺書': {
    narration: '蘇艾倫從書架後面抽出一個信封，上面用老式鋼筆寫著：「若我死於非命，請交給——」後面的字被撕掉了。',
    lines: [
      { char: 'c', line: '這……這是叔叔的字跡。他知道會發生這件事。（手在抖）他早就知道。', emotion: '震驚' },
      { char: 'a', line: '（接過信封）信封被拆開過。而且不是今天拆的。', emotion: '沉著觀察' },
      { char: 'b', line: '（非常輕聲）那封信……不應該還在。', emotion: '失控的一瞬間' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 9, trust: 2 } },
  },
  '警笛聲從遠處傳來': {
    narration: '遠處傳來斷斷續續的警笛聲，在雪夜裡格外清晰。時間忽然變得很具體——它正在倒數。',
    lines: [
      { char: 'b', line: '（第一次表現出真正的緊張）警察……這麼快。', emotion: '慌亂' },
      { char: 'a', line: '大約還有十分鐘。十分鐘後你們說的每一句話都會變成正式紀錄。', emotion: '平靜但帶著壓迫' },
      { char: 'c', line: '那我現在要說實話嗎？（看向林威廉）還是等一下再說？', emotion: '關鍵抉擇的邊緣' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 8, trust: 3 } },
  },
  '其中一人情緒突然崩潰': {
    narration: '沒有任何預兆。蘇艾倫的茶杯掉在地上，碎成幾片。然後她開始哭，壓抑很久的那種哭法，沒有眼淚，只有聲音。',
    lines: [
      { char: 'c', line: '我改了遺囑！好，我說了！我改了遺囑，叔叔發現了，但我沒有殺他！我沒有！', emotion: '崩潰' },
      { char: 'a', line: '（靜靜等她說完）我知道不是你。', emotion: '平靜' },
      { char: 'b', line: '（臉色變得非常難看）……', emotion: '沉默，但眼神不對' },
    ],
    emotions: { a: { anger: 3, fear: 1, trust: 4 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 3, fear: 7, trust: 5 } },
  },
  '兩人發生激烈肢體衝突': {
    narration: '林威廉的手突然抓住了陳修遠的衣領。這個動作讓所有人都愣住了——三十年的隱忍，在這一秒撕開了一個口。',
    lines: [
      { char: 'b', line: '你以為你是誰？（聲音在顫）你以為真相能改變什麼？', emotion: '憤怒崩潰' },
      { char: 'a', line: '（沒有反抗，平靜看著他）能。對你不行，對其他人行。', emotion: '冰冷' },
      { char: 'c', line: '（尖叫）住手！（試圖拉開他們）住手！', emotion: '驚恐' },
    ],
    emotions: { a: { anger: 5, fear: 2, trust: 2 }, b: { anger: 10, fear: 9, trust: 1 }, c: { anger: 7, fear: 10, trust: 1 } },
  },
}

// ── 通用導演介入（不在預設列表時）────────────────────────────────────────────

const GENERIC_DIRECTOR = [
  {
    narration: '某件事在這個時刻突然發生，改變了房間裡的重力。',
    lines: [
      { char: 'a', line: '（停下）這改變了一些事。', emotion: '重新計算' },
      { char: 'b', line: '（沒有說話，但表情移動了）', emotion: '按捺' },
      { char: 'c', line: '現在怎麼辦？告訴我現在怎麼辦。', emotion: '依賴' },
    ],
    emotions_delta: { a: { anger: 0, fear: 1, trust: -1 }, b: { anger: 1, fear: 2, trust: -1 }, c: { anger: 1, fear: 2, trust: 0 } },
  },
  {
    narration: '沒有人預料到這個。有些事情一旦發生，就再也無法假裝沒看見。',
    lines: [
      { char: 'a', line: '有意思。這讓情況複雜了一點。', emotion: '分析' },
      { char: 'c', line: '（退後一步）這不是我造成的。', emotion: '防衛' },
      { char: 'b', line: '也許我們應該先冷靜下來。', emotion: '強迫鎮定' },
    ],
    emotions_delta: { a: { anger: 0, fear: 0, trust: -1 }, b: { anger: 1, fear: 1, trust: -1 }, c: { anger: 2, fear: 2, trust: -1 } },
  },
]

// ── 非預設角色的通用腳本 ────────────────────────────────────────────────────

const GENERIC_BEATS = [
  { narration: '氣氛在沉默中持續升溫，沒有人願意先開口。',
    line_pools: {
      high_anger: ['你以為我不知道你在想什麼？', '夠了。別再演了。', '我不打算繼續忍了。'],
      high_fear:  ['……我、我不確定你說的是什麼。', '請不要這樣看著我。', '這跟我真的沒有關係。'],
      low_trust:  ['你說的每一件事我都要重新想一遍。', '也許你才是最該被懷疑的人。', '我不知道能相信誰。'],
      neutral:    ['我們需要把事情說清楚。', '先把已知的整理一遍。', '這裡面有什麼東西還沒說出來。'],
    }
  },
]

function getLineForChar(emMap, id, hasIntervention) {
  const em = emMap[id] || { anger: 3, fear: 3, trust: 5 }
  const pools = GENERIC_BEATS[0].line_pools
  if (hasIntervention) return { line: '（因突發狀況而沉默，重新計算局勢）', emotion: '警覺' }
  if (em.anger >= 7) return { line: pick(pools.high_anger), emotion: '憤怒' }
  if (em.fear >= 7)  return { line: pick(pools.high_fear),  emotion: '恐懼' }
  if (em.trust <= 2) return { line: pick(pools.low_trust),  emotion: '懷疑' }
  return { line: pick(pools.neutral), emotion: '冷靜' }
}

// ── 主生成函式 ───────────────────────────────────────────────────────────────

function generateLocal(systemPrompt, intervention) {
  const hasIntervention = intervention && !intervention.includes('繼續推進') && !intervention.includes('只輸出JSON')
  const useDefault = isDefaultStory(systemPrompt)

  // 導演介入：優先查預設腳本
  if (hasIntervention && useDefault) {
    const key = Object.keys(DIRECTOR_RESPONSES).find(k => intervention.includes(k))
    if (key) {
      const beat = DIRECTOR_RESPONSES[key]
      return {
        narration: beat.narration,
        lines: beat.lines,
        decisions: beat.lines.map(l => ({ char: l.char, intent: '對突發事件反應', because: '導演指令強制觸發' })),
        director_effect: `導演指令「${key}」已觸發，角色依性格即時回應。`,
        emotions: beat.emotions,
      }
    }
    // 通用導演介入
    const generic = pick(GENERIC_DIRECTOR)
    const ids = extractCharIds(systemPrompt)
    const curEm = extractEmotions(systemPrompt)
    const newEm = {}
    for (const id of ids) {
      const e = curEm[id] || { anger: 3, fear: 3, trust: 5 }
      const d = generic.emotions_delta[id] || { anger: 0, fear: 1, trust: -1 }
      newEm[id] = { anger: clamp(e.anger + d.anger), fear: clamp(e.fear + d.fear), trust: clamp(e.trust + d.trust) }
    }
    return {
      narration: generic.narration,
      lines: generic.lines.filter(l => ids.includes(l.char)),
      decisions: generic.lines.map(l => ({ char: l.char, intent: '對突發事件反應', because: '導演指令強制觸發' })),
      director_effect: `導演指令「${intervention}」已觸發。`,
      emotions: newEm,
    }
  }

  // 非介入：走腳本或通用
  if (useDefault) {
    const beatIndex = Math.min(_localRound, STORY_BEATS.length - 1 + EPILOGUE_BEATS.length)
    const beat = _localRound < STORY_BEATS.length
      ? STORY_BEATS[_localRound]
      : EPILOGUE_BEATS[Math.min(_localRound - STORY_BEATS.length, EPILOGUE_BEATS.length - 1)]
    _localRound++
    return {
      narration: beat.narration,
      lines: beat.lines,
      decisions: beat.decisions,
      director_effect: '',
      emotions: beat.emotions,
    }
  }

  // 通用角色（自訂設定）
  const ids = extractCharIds(systemPrompt)
  const curEm = extractEmotions(systemPrompt)
  const speakerCount = Math.random() < 0.35 ? 1 : (Math.random() < 0.6 ? 2 : Math.min(3, ids.length))
  const speakers = [...ids].sort(() => Math.random() - 0.5).slice(0, speakerCount)
  const lines = speakers.map(id => ({ char: id, ...getLineForChar(curEm, id, hasIntervention) }))
  const newEm = {}
  for (const id of ids) {
    const e = curEm[id] || { anger: 3, fear: 3, trust: 5 }
    newEm[id] = { anger: clamp(e.anger + (Math.random() < 0.5 ? 1 : -1)), fear: clamp(e.fear + (Math.random() < 0.5 ? 1 : -1)), trust: clamp(e.trust + (Math.random() < 0.5 ? 1 : -1)) }
  }
  return {
    narration: pick(['沉默在房間裡蔓延。', '沒有人願意先開口。', '某個東西在空氣中繃緊。', '時間以奇怪的方式流動著。']),
    lines,
    decisions: speakers.map(id => ({ char: id, intent: '依角色設定行動', because: '本地規則引擎' })),
    director_effect: '',
    emotions: newEm,
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function callClaude(messages, systemPrompt = '', options = {}) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const intervention = lastUser?.content || '繼續推進對話'
  const engine = options.engine || 'claude-code'

  // Local engine: fully in-browser, no server needed
  if (engine === 'local') {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500))
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
