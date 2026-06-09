/**
 * Local engine — linear scripted murder mystery with built-in director events.
 *
 * The story progresses through 8 beats in fixed order.
 * Certain beats include a pre-scripted director intervention
 * (停電、遺書、崩潰、警笛) baked directly into the narrative —
 * no user input needed, but user interventions still override.
 */

// ─── Session state ────────────────────────────────────────────────────────────

let _round = 0

export function resetLocalEngine() {
  _round = 0
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDefaultStory(sp) {
  return sp.includes('林威廉') && sp.includes('蘇艾倫') && sp.includes('陳修遠')
}
function extractCharIds(sp) {
  const m = [...sp.matchAll(/角色\d+\/([a-z])\(/g)]
  return m.length ? m.map(x => x[1]) : ['a', 'b', 'c']
}
function extractEmotions(sp) {
  const map = {}
  for (const [, id, a, f, t] of sp.matchAll(/角色\d+\/([a-z])\([^)]+\)[^；]*；情緒怒(\d+)懼(\d+)信(\d+)/g))
    map[id] = { anger: +a, fear: +f, trust: +t }
  return map
}
function clamp(v) { return Math.max(0, Math.min(10, v)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function publicAsset(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

function cleanLocalIntervention(text = '') {
  return String(text)
    .replace(/^【導演介入】/, '')
    .replace(/\n.*$/s, '')
    .replace(/，?只輸出JSON。?$/, '')
    .trim()
}

// ─── Linear story beats (8 rounds) ───────────────────────────────────────────
//
// director_event: shown in the director_effect field and logged as [ 導演 ]
// beats with director_event are pre-scripted interventions built into the story.

const STORY = [

  // ── Round 0 · 開場：初次對峙 ──────────────────────────────────────────────
  {
    narration: '三人站在書房的不同角落。壁爐的火已滅，只剩灰燼。死者的血跡在地毯上乾成深褐色，沒有人敢靠近那個位置。',
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
    director_event: null,
    emotions: { a: { anger: 3, fear: 1, trust: 3 }, b: { anger: 1, fear: 6, trust: 5 }, c: { anger: 5, fear: 8, trust: 2 } },
  },

  // ── Round 1 · 時間線矛盾 ──────────────────────────────────────────────────
  {
    narration: '陳修遠在房間裡慢慢踱步，目光掃過每個人的手。林威廉始終保持著精準的距離——不遠不近，像站在一個預先計算好的位置。',
    lines: [
      { char: 'a', line: '林先生，你說最後一次見到死者是晚上九點。但廚娘說她十點還聽到書房有兩個人說話。', emotion: '試探' },
      { char: 'b', line: '廚娘年紀大了，耳力不好。那時我已在地下室清點酒窖，帳本上有記錄。', emotion: '從容' },
      { char: 'c', line: '（小聲）帳本……他一直在說帳本……', emotion: '若有所思' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '用矛盾資訊逼出林威廉的漏洞', because: '時間線對不上是突破口' },
      { char: '管家林威廉', intent: '用不可查驗的證人反駁', because: '必須維持不在場證明' },
      { char: '繼承人蘇艾倫', intent: '帳本讓她聯想到改遺囑的事', because: '心虛讓她對某些詞特別敏感' },
    ],
    director_event: null,
    emotions: { a: { anger: 3, fear: 1, trust: 3 }, b: { anger: 2, fear: 7, trust: 4 }, c: { anger: 5, fear: 9, trust: 1 } },
  },

  // ── Round 2 · 【導演介入：突然停電】──────────────────────────────────────
  {
    narration: '燈光在一聲悶響後全部熄滅。黑暗像布幕一樣落下，三個人誰都沒有動——或者說，幾乎沒有。腳步聲在黑暗中朝著門口移動。',
    lines: [
      { char: 'a', line: '（沉聲）誰都不准移動。', emotion: '警覺' },
      { char: 'b', line: '保險絲應該在地下室……我去——', emotion: '試圖離開' },
      { char: 'c', line: '不要讓他走！保險絲箱在地下室，不在走廊！我在這裡住了二十年，我知道！', emotion: '尖叫' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '利用黑暗預判行動，堵在門口', because: '有意圖逃跑的人才會在停電時往門口走' },
      { char: '管家林威廉', intent: '試圖趁停電離開，謊言被拆穿', because: '慌亂讓他說出地點錯誤的藉口' },
      { char: '繼承人蘇艾倫', intent: '無意中提供最關鍵的反駁', because: '她對房子的熟悉程度超過林威廉的預期' },
    ],
    director_event: '突然停電',
    emotions: { a: { anger: 5, fear: 2, trust: 2 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 6, fear: 9, trust: 3 } },
  },

  // ── Round 3 · 停電後的餘震 ────────────────────────────────────────────────
  {
    narration: '燈光恢復了。林威廉還站在門口，陳修遠就站在他面前。蘇艾倫意識到自己說了什麼，捂住嘴，但話已經說出去了。',
    lines: [
      { char: 'a', line: '（平靜）你要去哪裡？', emotion: '堵在門口，不動' },
      { char: 'b', line: '我……我只是想去確認……', emotion: '第一次真正失去從容' },
      { char: 'c', line: '（顫聲）他說謊了。他連保險絲箱在哪裡都說錯了。他在這裡住了三十年。', emotion: '驚恐中有一種清醒' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '不追問，讓沉默說話', because: '林威廉站在門口本身就是答案' },
      { char: '管家林威廉', intent: '解釋已無意義，開始真正崩潰', because: '被最不在意的人用最簡單的話拆穿' },
      { char: '繼承人蘇艾倫', intent: '從旁觀者變成關鍵證人', because: '她說的那句話改變了這個夜晚的走向' },
    ],
    director_event: null,
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 5, fear: 8, trust: 3 } },
  },

  // ── Round 4 · 【導演介入：有人發現密室中的遺書】────────────────────────
  {
    narration: '蘇艾倫退到書架旁，手碰到一個信封——夾在最高層的縫隙裡，上面用老式鋼筆寫著：「若我死於非命，請交給——」後面的字被撕掉了。',
    lines: [
      { char: 'c', line: '（聲音在顫）這……這是叔叔的字跡。他知道會發生這件事。他早就知道。', emotion: '震驚' },
      { char: 'a', line: '（接過信封，看了很久）信封被拆開過。而且不是今天拆的。', emotion: '沉著' },
      { char: 'b', line: '（非常輕聲，幾乎對自己說）那封信……不應該還在。', emotion: '失控的一瞬間' },
    ],
    decisions: [
      { char: '繼承人蘇艾倫', intent: '無意發現，成為另一個關鍵的人', because: '她退開是因為恐懼，卻因此找到了證據' },
      { char: '偵探陳修遠', intent: '讓信封的細節說話，不急著逼問', because: '林威廉已經說出了最重要的話' },
      { char: '管家林威廉', intent: '說出「不應該還在」——徹底暴露知情', because: '震驚讓他失去了語言過濾' },
    ],
    director_event: '有人發現密室中的遺書',
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 9, trust: 3 } },
  },

  // ── Round 5 · 遺書的重量 ──────────────────────────────────────────────────
  {
    narration: '信紙攤開在桌上。死者用顫抖的手寫下了一個名字，然後在名字下面畫了一條線——像是最後的確認，也像是原諒。林威廉看著那個名字，長時間沒有說話。',
    lines: [
      { char: 'a', line: '（把信紙推向林威廉）這是你的名字。他知道是你。他選擇留下來等你。', emotion: '平靜的重量' },
      { char: 'b', line: '（極輕）他……他怎麼知道。（更輕）他一直都知道。', emotion: '不是在問，是說給自己聽' },
      { char: 'c', line: '（哽咽）叔叔一個人在書房寫這封信……他知道那天晚上會發生什麼。', emotion: '哀傷蓋過恐懼' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '讓遺書說話，自己退到後面', because: '有時候沉默比逼問更有力量' },
      { char: '管家林威廉', intent: '三十年的對抗在這一刻有了答案——死者早就知道了', because: '這比被逮捕更讓他崩潰' },
      { char: '繼承人蘇艾倫', intent: '第一次想到叔叔這個人，而不只是那份遺產', because: '哀傷是真實的' },
    ],
    director_event: null,
    emotions: { a: { anger: 3, fear: 1, trust: 4 }, b: { anger: 4, fear: 10, trust: 1 }, c: { anger: 3, fear: 7, trust: 4 } },
  },

  // ── Round 6 · 【導演介入：警笛聲從遠處傳來】──────────────────────────
  {
    narration: '遠處傳來斷斷續續的警笛聲，在雪夜裡格外清晰。時間忽然變得很具體——它正在倒數。',
    lines: [
      { char: 'b', line: '（第一次表現出真正的慌亂）警察……這麼快。', emotion: '慌亂' },
      { char: 'a', line: '大約還有十分鐘。十分鐘後你們說的每一句話都會變成正式紀錄。', emotion: '壓迫' },
      { char: 'c', line: '（看向林威廉，然後看向陳修遠）我要說實話了。全部的實話。', emotion: '抉擇' },
    ],
    decisions: [
      { char: '管家林威廉', intent: '外部壓力讓所有算計加速瓦解', because: '時間是他最後的敵人' },
      { char: '偵探陳修遠', intent: '用剩餘時間製造最後的壓力', because: '警察到來前是最後的機會' },
      { char: '繼承人蘇艾倫', intent: '決定主動坦承——與其被動被揭穿，不如先說', because: '求生欲讓她做出最理性的選擇' },
    ],
    director_event: '警笛聲從遠處傳來',
    emotions: { a: { anger: 4, fear: 1, trust: 4 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 4, fear: 7, trust: 4 } },
  },

  // ── Round 7 · 尾聲：真相落地 ──────────────────────────────────────────────
  {
    narration: '蘇艾倫說完之後，房間裡很安靜。林威廉靠著牆坐了下去，不是被推倒，是自己選擇坐下的。外面的警笛越來越近。',
    lines: [
      { char: 'c', line: '我改了遺囑。叔叔發現了。但我沒有殺他。殺他的人就在這個房間裡，你們都知道是誰。', emotion: '精疲力竭的清醒' },
      { char: 'b', line: '（坐在地上，聲音很平）他說他要把我趕走。三十年後，他說要把我趕走。', emotion: '空洞' },
      { char: 'a', line: '我知道。（蹲下來，和他同樣高度）但這不是你殺他的理由。', emotion: '不是在指責，是陳述' },
    ],
    decisions: [
      { char: '繼承人蘇艾倫', intent: '說完一切，把真相交出去', because: '她已經沒有力氣繼續隱瞞' },
      { char: '管家林威廉', intent: '說出三十年壓抑的動機——不是恨，是被拋棄', because: '防線崩潰後反而能說出真心話' },
      { char: '偵探陳修遠', intent: '放下偵探的距離，以人的方式靠近', because: '案子結束了，他終於可以只是一個人' },
    ],
    director_event: null,
    emotions: { a: { anger: 2, fear: 2, trust: 5 }, b: { anger: 2, fear: 7, trust: 3 }, c: { anger: 2, fear: 5, trust: 5 } },
  },
]

// ─── Director intervention override scripts ───────────────────────────────────
// When user manually clicks an intervention, this overrides the current beat

const MANUAL_INTERVENTIONS = {
  '突然停電': {
    narration: '燈光在一聲悶響後全部熄滅。黑暗像布幕一樣落下，沒有人說話，只有呼吸聲。',
    lines: [
      { char: 'a', line: '（沉聲）誰都不准移動。', emotion: '警覺' },
      { char: 'b', line: '保險絲應該在……我去——', emotion: '試圖離開' },
      { char: 'c', line: '不要讓他走！', emotion: '尖叫' },
    ],
    effect: '停電讓林威廉試圖趁亂離開，但被蘇艾倫一句話攔住。',
    emotions: { a: { anger: 5, fear: 3, trust: 2 }, b: { anger: 3, fear: 9, trust: 2 }, c: { anger: 6, fear: 10, trust: 1 } },
  },
  '其中一人說謊': {
    narration: '陳修遠停下腳步，把剛才聽到的話在腦海裡重放了一遍。有什麼地方不對。',
    lines: [
      { char: 'a', line: '等等。你剛才說九點半——但你一分鐘前說的是九點。', emotion: '銳利' },
      { char: 'b', line: '我……我說錯了。', emotion: '強行鎮定' },
      { char: 'c', line: '他說謊了。他一直在說謊。', emotion: '驚恐' },
    ],
    effect: '矛盾的時間線被公開指出，林威廉壓力驟增。',
    emotions: { a: { anger: 4, fear: 1, trust: 2 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 7, fear: 9, trust: 1 } },
  },
  '門外傳來陌生腳步聲': {
    narration: '走廊上傳來腳步聲，緩慢而有節奏，在門口停下了。三個人同時轉頭——但門沒有打開。',
    lines: [
      { char: 'c', line: '有人在外面。有人在聽我們說話。', emotion: '顫抖' },
      { char: 'a', line: '（走向門口）誰在那裡？', emotion: '戒備' },
      { char: 'b', line: '……也許是老宅的聲音。這棟房子很老了。', emotion: '刻意平靜，目光飄向別處' },
    ],
    effect: '林威廉的目光飄向別處，他知道那是誰。',
    emotions: { a: { anger: 4, fear: 3, trust: 2 }, b: { anger: 3, fear: 8, trust: 3 }, c: { anger: 5, fear: 10, trust: 1 } },
  },
  '有人發現密室中的遺書': {
    narration: '信封從書架後面掉出來，上面用老式鋼筆寫著：「若我死於非命，請交給——」後面的字被撕掉了。',
    lines: [
      { char: 'c', line: '這是叔叔的字跡。他知道會發生這件事。他早就知道。', emotion: '震驚' },
      { char: 'a', line: '（接過）信封被拆開過。而且不是今天拆的。', emotion: '沉著' },
      { char: 'b', line: '（極輕）那封信……不應該還在。', emotion: '失控的一瞬間' },
    ],
    effect: '林威廉說出「不應該還在」，徹底暴露知情。',
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 9, trust: 2 } },
  },
  '警笛聲從遠處傳來': {
    narration: '警笛聲從雪地裡穿透過來，清晰而急促。時間忽然變得很具體。',
    lines: [
      { char: 'b', line: '警察……這麼快。', emotion: '慌亂' },
      { char: 'a', line: '大約還有十分鐘。十分鐘後每句話都是正式紀錄。', emotion: '壓迫' },
      { char: 'c', line: '那我現在要說實話了。', emotion: '決定' },
    ],
    effect: '警笛加速了所有人的計算，蘇艾倫做出抉擇。',
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 4, fear: 7, trust: 4 } },
  },
  '其中一人情緒突然崩潰': {
    narration: '茶杯掉在地上，碎成幾片。蘇艾倫開始哭——壓抑很久的那種，沒有眼淚，只有聲音。',
    lines: [
      { char: 'c', line: '我改了遺囑！好，我說了！但我沒有殺他！我沒有！', emotion: '崩潰' },
      { char: 'a', line: '我知道不是你。', emotion: '平靜' },
      { char: 'b', line: '（臉色變得非常難看）……', emotion: '沉默，眼神不對' },
    ],
    effect: '蘇艾倫主動坦承，把調查方向完全指向林威廉。',
    emotions: { a: { anger: 3, fear: 1, trust: 4 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 3, fear: 7, trust: 5 } },
  },
  '兩人發生激烈肢體衝突': {
    narration: '林威廉的手突然抓住了陳修遠的衣領。三十年的隱忍，在這一秒撕開了一個口。',
    lines: [
      { char: 'b', line: '你以為真相能改變什麼？', emotion: '憤怒崩潰' },
      { char: 'a', line: '（沒有反抗）能。對你不行，對其他人行。', emotion: '冰冷' },
      { char: 'c', line: '住手！', emotion: '驚恐' },
    ],
    effect: '肢體衝突讓林威廉失去理智上的最後優勢。',
    emotions: { a: { anger: 5, fear: 2, trust: 2 }, b: { anger: 10, fear: 9, trust: 1 }, c: { anger: 7, fear: 10, trust: 1 } },
  },
}

const GENERIC_INTERVENTION = [
  { narration: '某件事在這個時刻突然發生，改變了房間裡的重力。',
    lines: [
      { char: 'a', line: '（停下）這改變了一些事。', emotion: '重新計算' },
      { char: 'b', line: '（沒有說話）', emotion: '按捺' },
      { char: 'c', line: '現在怎麼辦？告訴我怎麼辦。', emotion: '依賴' },
    ],
    effect: '突發事件讓局勢出現新的變量。',
    emotions: { a: { anger: 4, fear: 2, trust: 2 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 5, fear: 9, trust: 2 } },
  },
  { narration: '有些事情一旦發生，就再也無法假裝沒看見。',
    lines: [
      { char: 'a', line: '有意思。情況複雜了一點。', emotion: '分析' },
      { char: 'c', line: '這不是我造成的。', emotion: '防衛' },
      { char: 'b', line: '也許我們先冷靜下來。', emotion: '強迫鎮定' },
    ],
    effect: '三人重新評估彼此的立場。',
    emotions: { a: { anger: 4, fear: 2, trust: 2 }, b: { anger: 4, fear: 8, trust: 2 }, c: { anger: 6, fear: 9, trust: 1 } },
  },
]

// ─── Generic fallback for custom characters ───────────────────────────────────

const GENERIC_NARRATIONS = [
  '沉默在房間裡蔓延，空氣因緊繃而凝固。',
  '某個東西在氣氛中繃緊，像快要斷裂的弦。',
  '沒有人願意先開口，每個人都在等別人暴露更多。',
  '時間以奇怪的方式緩慢流動，每一秒都帶著重量。',
]

function genericLine(em) {
  if (em.anger >= 7) return pick(['你以為我不知道你在想什麼？', '夠了，別再演了。', '我不打算繼續忍了。'])
  if (em.fear >= 7)  return pick(['……我不確定你在說什麼。', '請不要這樣看著我。', '這跟我真的沒有關係。'])
  if (em.trust <= 2) return pick(['你說的每一件事我都要重新想一遍。', '也許你才是最該被懷疑的人。'])
  return pick(['我們需要把已知的東西整理一遍。', '先冷靜，把事情說清楚。', '有些東西還沒說出來。'])
}
function emotionLabel(em) {
  if (em.anger >= 7) return '憤怒'
  if (em.fear >= 7)  return '恐懼'
  if (em.trust <= 2) return '懷疑'
  if (em.anger >= 4) return '不滿'
  if (em.fear >= 4)  return '緊張'
  return '冷靜'
}

function extractCharacters(sp) {
  const chars = {}
  for (const match of sp.matchAll(/角色\d+\/([a-z])\(([^)]+)\)：性格「([^」]*)」目的「([^」]*)」關係「([^」]*)」秘密「([^」]*)」語氣「([^」]*)」/g)) {
    chars[match[1]] = {
      id: match[1],
      name: match[2],
      trait: match[3],
      goal: match[4],
      relation: match[5],
      secret: match[6],
      tone: match[7],
    }
  }
  return chars
}

function interventionKind(text = '') {
  if (/停電|黑暗|斷電|燈/.test(text)) return 'threat'
  if (/說謊|抓包|證據|遺書|遺囑|資料|真相|錄音|監控/.test(text)) return 'evidence'
  if (/腳步|門外|闖入|出現|進場|陌生/.test(text)) return 'arrival'
  if (/警笛|倒數|時間|追兵|白塔|警察/.test(text)) return 'pressure'
  if (/崩潰|哭|失控|尖叫|昏倒/.test(text)) return 'breakdown'
  if (/衝突|打|推|抓|攻擊|槍|刀/.test(text)) return 'violence'
  return 'turn'
}

function localEventNarration(event, kind) {
  const base = event.replace(/^【導演介入】/, '').replace(/\n.*$/s, '').trim()
  const prefix = {
    threat: '燈光、聲音或環境突然改變，場景裡的安全感被抽走。',
    evidence: '新的證據被推到所有人面前，原本能維持的謊言開始鬆動。',
    arrival: '場景邊界被打破，有人或某種聲音闖進了原本封閉的局面。',
    pressure: '外部壓力逼近，角色不再有時間慢慢編造理由。',
    breakdown: '某個人的情緒防線忽然裂開，房間裡的節奏被迫改變。',
    violence: '肢體距離被打破，衝突從語言滑向更危險的位置。',
    turn: '導演指令讓原本的局面偏離軌道。',
  }[kind]
  return `${prefix}【${base}】成為本輪所有反應的中心。`
}

function eventLineFor(char, em, event, kind, mentioned) {
  const name = char?.name || '我'
  if (mentioned) {
    return `你們都聽見了，這件事指向我。可如果我要回應「${event}」，我不會照你們期待的方式回應。`
  }
  if (kind === 'threat') {
    if (em.fear >= 6) return `先別動。${event}不是背景聲，它是在逼我們露出反應。`
    return `這種時候最有用的不是尖叫，是看誰第一個想離開。`
  }
  if (kind === 'evidence') {
    if (em.trust <= 3) return `這份線索來得太剛好。我不相信剛好的東西。`
    return `如果${event}是真的，那我們剛才有一半話都要重算。`
  }
  if (kind === 'arrival') {
    return `別只看門口。真正知道${event}會發生的人，現在應該在看我們的表情。`
  }
  if (kind === 'pressure') {
    if (em.anger >= 6) return `時間少了正好，省得大家繼續演。`
    return `壓力來了。現在每句話都會比剛才更接近真相。`
  }
  if (kind === 'breakdown') {
    return `看著我，${name}還撐得住。撐不住的人，才會把真正的東西說出口。`
  }
  if (kind === 'violence') {
    return `退後。再往前一步，這場戲就不是對話了。`
  }
  return `「${event}」改變了局勢。現在每個人都得重新選邊。`
}

function shiftForIntervention(em, kind, mentioned) {
  const boosts = {
    threat: [0, 2, -1],
    evidence: [1, 1, -2],
    arrival: [0, 2, -1],
    pressure: [1, 1, -1],
    breakdown: [1, 2, 0],
    violence: [2, 2, -2],
    turn: [1, 1, -1],
  }[kind]
  return {
    anger: clamp(em.anger + boosts[0] + (mentioned ? 1 : 0)),
    fear: clamp(em.fear + boosts[1] + (mentioned ? 1 : 0)),
    trust: clamp(em.trust + boosts[2]),
  }
}

function lineAdjustmentFor(kind, event, index) {
  const compactEvent = event.slice(0, 40)
  const variants = {
    threat: [
      `先別動。${compactEvent}發生得太剛好，現在誰反應最快，誰就最可疑。`,
      `這種變故不會憑空出現。有人在利用它改變局面。`,
      `我聽見了。也看見了你們剛才的反應。`,
    ],
    evidence: [
      `那麼，${compactEvent}就把剛才的話全都推翻了。`,
      `如果這是真的，有人剛才至少說了一個謊。`,
      `證據出現得越晚，越像是有人不希望它被看見。`,
    ],
    arrival: [
      `別只看門口。${compactEvent}讓這裡不再只有我們幾個人。`,
      `有人在外面，也可能早就在聽了。`,
      `如果那不是意外，那就是警告。`,
    ],
    pressure: [
      `${compactEvent}讓時間變少了。現在沒有空慢慢演。`,
      `越接近結束，越容易有人犯錯。`,
      `很好，壓力終於讓每個人都開始像自己了。`,
    ],
    breakdown: [
      `${compactEvent}不是插曲，是有人撐不住了。`,
      `崩潰時說出口的話，未必完整，但通常不全是假的。`,
      `別急著安慰。讓他把下一句說完。`,
    ],
    violence: [
      `退後。${compactEvent}一旦越線，這就不是問話了。`,
      `動手只會證明你比剛才更害怕。`,
      `現在誰先碰誰，誰就把理由交出來。`,
    ],
    turn: [
      `${compactEvent}改變了我們剛才的順序。`,
      `這件事讓原本的說法少了一塊。`,
      `先回答這個，再談你剛才想藏的事。`,
    ],
  }[kind]
  return variants[index % variants.length]
}

function adaptLinearBeat(beat, event) {
  const kind = interventionKind(event)
  return {
    narration: `${beat.narration}\n\n導演介入：${localEventNarration(event, kind)}`,
    lines: beat.lines.map((line, index) => ({
      ...line,
      line: `${line.line} ${lineAdjustmentFor(kind, event, index)}`,
      emotion: `${line.emotion}・受介入影響`,
    })),
    decisions: beat.decisions.map(decision => ({
      ...decision,
      because: `${decision.because}；本輪同時受到導演指令「${event.slice(0, 60)}」影響`,
    })),
    director_event: event,
    emotions: Object.fromEntries(Object.entries(beat.emotions).map(([id, em], index) => [
      id,
      shiftForIntervention(em, kind, index === 0),
    ])),
  }
}

// ─── Local report generation ──────────────────────────────────────────────────

function generateLocalReport(prompt) {
  const nameMatches = [...prompt.matchAll(/角色[A-Z]\(([^)]+)\)/g)].map(m => m[1])
  const [charA, charB, charC] = nameMatches.length >= 3
    ? nameMatches : ['偵探陳修遠', '管家林威廉', '繼承人蘇艾倫']

  return {
    story: {
      plot_points: [
        `${charC}的秘密曝光：她私自竄改了死者的遺囑，死者發現後質問她`,
        `${charB}說謊：謊稱九點離開書房，廚娘的證詞與帳本記錄相互矛盾`,
        `停電時${charB}試圖趁亂逃跑，卻被${charC}一句話拆穿——「保險絲箱不在走廊，在地下室，我住這裡二十年，我知道」`,
        `密室書架發現遺書：死者早知自己將死，信封被拆開過，拆開的人不是今天才動手的`,
        `${charB}失口說出「那封信不應該還在」——徹底暴露他事先知情`,
        `遺書上的名字是${charB}，死者選擇等待而非報警，選擇了某種形式的原諒`,
        `${charC}在警笛聲中主動坦承全部，把矛頭完整指向${charB}`,
        `${charB}的動機：「他說要把我趕走。三十年後，他說要把我趕走。」`,
      ],
      draft: `書房裡只剩警笛聲和呼吸聲。${charB}靠著牆坐了下去，不是被推倒，是自己選擇坐下的。${charC}說完了所有事——遺囑、叔叔、那個她以為只有自己知道的秘密。${charA}蹲下來，和${charB}同樣的高度。「他說他要把我趕走，」${charB}說，「三十年後，他說要把我趕走。」${charA}沒有站起來。「我知道。但這不是你殺他的理由。」窗外的雪還在下。沒有人說話，但每個人都聽到了。`,
    },
    arcs: [
      { char: charA, arc: '從掌控現場的偵探，到蹲下來以人的方式靠近——案子結束後，他才能只是一個人' },
      { char: charB, arc: '三十年的過度禮貌在停電那一刻撕裂；被遺書擊潰後，說出的不是認罪，而是被拋棄的事實' },
      { char: charC, arc: '從驚慌自保到無意間成為關鍵證人，再到主動坦承——求生欲在最後一刻轉化成了勇氣' },
    ],
    usable_lines: [
      { line: '「誰都不准移動。」', speaker: charA, tone: '停電後第一句話，不高聲，卻讓整個房間靜止' },
      { line: '「保險絲箱在地下室，不在走廊。我在這裡住了二十年，我知道。」', speaker: charC, tone: '驚恐中爆出，無意間成為全場最關鍵的一句話' },
      { line: '「那封信……不應該還在。」', speaker: charB, tone: '極輕，幾乎是說給自己聽，震驚讓他忘記了過濾' },
      { line: '「他說他要把我趕走。三十年後，他說要把我趕走。」', speaker: charB, tone: '坐在地上，聲音平得像在陳述別人的故事' },
      { line: '「但這不是你殺他的理由。」', speaker: charA, tone: '蹲下來說的，不是指控，是陳述，比站著說更重' },
    ],
    tension: '停電後燈光亮起、林威廉站在門口的那一秒——所有的計算在這個畫面裡同時結束，沒有人需要再說什麼',
    paths: [
      { label: '遺書的後半段', desc: '被撕掉的那半張紙藏著什麼？死者的「原諒」是否也在那裡？' },
      { label: '三十年的細節', desc: '林威廉說出那三十年裡發生的事，每個細節都讓動機更清晰，也更令人無法簡單定義' },
      { label: '蘇艾倫的遺囑', desc: '她坦承了改遺囑，但遺囑內容是什麼？那份文件還存在嗎？' },
    ],
    comics: [
      {
        title: '暗格被撬開',
        shot: `壁爐旁暗格被撬開，${charA}蹲在暗格前，${charB}手藏身後，${charC}臉色慘白後退。`,
        caption: '暗格開啟的瞬間，房間裡的每個人都多了一個秘密。',
        dialogue: '「這個撬痕不是第一次出現。」',
        palette: '冷灰陰影、火橘壁爐光、金屬反光',
        image: publicAsset('comics/manor-hidden-compartment.png'),
        prompt: `近現代推理懸疑漫畫，雪夜莊園密室，壁爐旁暗格被撬開，低角度構圖，三人形成三角張力：${charA}蹲在暗格前，${charB}站得筆直卻手藏身後，${charC}臉色慘白後退半步。畫面有火光、灰白粉末、金屬撬痕與壓迫感，寫實分鏡，細膩表情，冷灰與火橘光影對比強烈。`,
      },
      {
        title: '袖口粉末',
        shot: `${charB}袖口邊緣沾著極淡灰白粉末，${charA}從畫面左側切入，${charC}在背景盯著粉末。`,
        caption: '最小的粉末，比最大的謊言更難擦乾淨。',
        dialogue: '「林先生，你袖口上的是什麼？」',
        palette: '窗外雪光、灰白粉末、壓抑冷色',
        image: publicAsset('comics/butler-cuff-powder.png'),
        prompt: `連續漫畫第二格，特寫${charB}袖口邊緣沾著極淡灰白粉末，${charA}從畫面左側切入，眼神銳利，${charC}在背景失焦地盯著粉末。室內寒意明顯，窗外雪光透進來，莊園走廊陰影延伸，鏡頭緊迫，寫實懸疑風格，細節清楚，壓抑感強。`,
      },
      {
        title: '走廊的金屬聲',
        shot: `長走廊盡頭有金屬碰撞的反光，門縫滲入冷風，三人同時僵住。`,
        caption: '真正的線索，不在房間裡等人看見。',
        dialogue: '「你們聽見了嗎？」',
        palette: '雪夜冷光、高對比陰影、遠處金屬反光',
        image: publicAsset('comics/snow-corridor-metal-glint.png'),
        prompt: `連續漫畫第三格，長走廊透視，門外雪壓窗框，門縫滲入冷風，遠處有一點金屬碰撞的反光，三人同時僵住。${charA}半轉身，${charB}背手克制，${charC}緊盯前方，氣氛封閉、猜忌、壓迫。高對比陰影、雪夜冷光、電影感分鏡，寫實漫畫風。`,
      },
    ],
  }
}

// ─── Main generation function ─────────────────────────────────────────────────

function generateLocal(systemPrompt, intervention) {
  const eventText = cleanLocalIntervention(intervention)
  const hasManualIntervention = eventText && !eventText.includes('繼續推進')

  const isDefault = isDefaultStory(systemPrompt)

  // ── Manual director intervention adjusts the current linear beat ──
  if (hasManualIntervention && isDefault) {
    const beatIndex = Math.min(_round, STORY.length - 1)
    const script = adaptLinearBeat(STORY[beatIndex], eventText)
    _round++
    return {
      narration: script.narration,
      lines: script.lines,
      decisions: script.decisions,
      director_effect: `導演指令「${eventText}」調整了第 ${beatIndex + 1} 段線性劇本的台詞與情緒。`,
      emotions: script.emotions,
    }
  }

  // ── Scripted linear story ──
  if (isDefault) {
    const beatIndex = Math.min(_round, STORY.length - 1)
    const beat = STORY[beatIndex]
    _round++

    return {
      narration: beat.narration,
      lines: beat.lines,
      decisions: beat.decisions,
      director_effect: beat.director_event
        ? `【導演介入】${beat.director_event}`
        : '',
      emotions: beat.emotions,
    }
  }

  // ── Generic characters (custom setup) ──
  const ids = extractCharIds(systemPrompt)
  const chars = extractCharacters(systemPrompt)
  const cur = extractEmotions(systemPrompt)
  const kind = interventionKind(eventText)
  const mentionedIds = ids.filter(id => chars[id]?.name && eventText.includes(chars[id].name))
  const count = hasManualIntervention ? Math.min(3, Math.max(1, mentionedIds.length || 2)) : Math.random() < 0.35 ? 1 : Math.random() < 0.6 ? 2 : Math.min(3, ids.length)
  const speakers = hasManualIntervention
    ? [...new Set([...mentionedIds, ...ids])].slice(0, count)
    : [...ids].sort(() => Math.random() - 0.5).slice(0, count)
  const newEm = {}
  for (const id of ids) {
    const e = cur[id] || { anger: 3, fear: 3, trust: 5 }
    newEm[id] = hasManualIntervention ? shiftForIntervention(e, kind, mentionedIds.includes(id)) : {
      anger: clamp(e.anger + (Math.random() < 0.5 ? 1 : -1)),
      fear:  clamp(e.fear  + (Math.random() < 0.5 ? 1 : -1)),
      trust: clamp(e.trust + (Math.random() < 0.5 ? 1 : -1)),
    }
  }
  return {
    narration: hasManualIntervention ? localEventNarration(eventText, kind) : pick(GENERIC_NARRATIONS),
    lines: speakers.map(id => {
      const e = cur[id] || { anger: 3, fear: 3, trust: 5 }
      return {
        char: id,
        line: hasManualIntervention ? eventLineFor(chars[id], e, eventText, kind, mentionedIds.includes(id)) : genericLine(e),
        emotion: hasManualIntervention ? `${emotionLabel(newEm[id])}・受指令牽動` : emotionLabel(e),
      }
    }),
    decisions: speakers.map(id => ({
      char: chars[id]?.name || id,
      intent: hasManualIntervention ? '回應導演介入造成的新局面' : '延續當前衝突',
      because: hasManualIntervention ? `本輪導演指令是「${eventText.slice(0, 80)}」` : '依照目前情緒與角色設定自然推進',
    })),
    director_effect: hasManualIntervention ? `Local engine 已將導演指令「${eventText.slice(0, 80)}」作為本輪事件核心。` : '',
    emotions: newEm,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function callClaude(messages, systemPrompt = '', options = {}) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const intervention = lastUser?.content || '繼續推進對話'
  const engine = options.engine || 'claude-code'
  const sessionId = options.sessionId || null

  if (engine === 'local') {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 400))

    if (intervention.startsWith('你是資深編劇顧問')) {
      const payload = generateLocalReport(intervention)
      return { parsed: payload, raw: JSON.stringify(payload) }
    }

    const payload = generateLocal(systemPrompt, intervention)
    return { parsed: payload, raw: JSON.stringify(payload) }
  }

  const id = crypto.randomUUID()
  options.onRequest?.(id)
  await fetch('/api/bridge/pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, sessionId, engine, intervention, systemPrompt, messages, ts: Date.now() }),
  })

  const start = Date.now()
  while (Date.now() - start < 300000) {
    await new Promise(r => setTimeout(r, 500))
    const params = new URLSearchParams({ id })
    if (sessionId) params.set('sessionId', sessionId)
    const res = await fetch(`/api/bridge/queue?${params.toString()}`)
    if (res.status === 200) {
      const payload = await res.json()
      return { parsed: payload, raw: JSON.stringify(payload) }
    }
  }
  throw new Error(`等待 ${engine} 回應逾時`)
}
