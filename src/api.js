/**
 * Local engine — scripted branching murder mystery.
 *
 * Director interventions set story flags that alter subsequent beats
 * and lead to one of three distinct endings:
 *   - "evidence"       物證路線（發現遺書 / 別針）
 *   - "breakdown"      崩潰路線（情緒崩潰 / 肢體衝突）
 *   - "escape_attempt" 逃脫路線（停電 / 腳步聲）
 *   - "default"        無介入的標準結局
 */

// ─── Session state ────────────────────────────────────────────────────────────

let _round = 0          // main story beat index
let _flags = new Set()  // triggered story flags
let _ending = null      // locked-in ending path (null until triggered)

// Reset is called when Stage remounts (new game)
export function resetLocalEngine() {
  _round = 0
  _flags = new Set()
  _ending = null
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

// ─── Main story beats (shared opening) ───────────────────────────────────────

const OPENING_BEATS = [
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
    emotions: { a: { anger: 3, fear: 1, trust: 3 }, b: { anger: 1, fear: 6, trust: 5 }, c: { anger: 5, fear: 8, trust: 2 } },
  },
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
    emotions: { a: { anger: 3, fear: 1, trust: 3 }, b: { anger: 2, fear: 7, trust: 4 }, c: { anger: 5, fear: 9, trust: 1 } },
  },
  {
    narration: '蘇艾倫的手一直在顫抖。她試圖靠近窗邊，像是想確認外面是否還有逃路。窗外是大雪，什麼都沒有。',
    lines: [
      { char: 'a', line: '蘇小姐，遺囑的事——你知道我指的是什麼。', emotion: '銳利' },
      { char: 'c', line: '我不知道你在說什麼！那份遺囑是叔叔自己的意思！', emotion: '崩潰邊緣' },
      { char: 'b', line: '（輕咳）也許蘇小姐需要一杯熱茶。偵探先生，何必逼得這麼緊？', emotion: '假意維護' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '直接點破遺囑議題，觀察她的崩潰程度', because: '她的反應已說明一切' },
      { char: '繼承人蘇艾倫', intent: '下意識否認，反應過激反而露出破綻', because: '被點名讓她失去控制' },
      { char: '管家林威廉', intent: '護著蘇艾倫，讓她欠人情，顯示自己善良', because: '讓兩人互相牽制對他有利' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 2, fear: 7, trust: 4 }, c: { anger: 7, fear: 10, trust: 1 } },
  },
]

// ─── Branching mid-section (affected by flags) ───────────────────────────────

const MID_BEATS = {
  default: {
    narration: '氣溫繼續下降。林威廉不再像最初那樣筆直站立，他的手悄悄握住了椅背。這是今晚第一次，他的姿態出現了破綻。',
    lines: [
      { char: 'a', line: '林先生服侍老爺三十年。三十年，一個人可以累積很多恨意。', emotion: '緩慢，每字清晰' },
      { char: 'b', line: '（停頓三秒）我不知道偵探先生這話是什麼意思。', emotion: '第一次失去從容' },
      { char: 'c', line: '他的手在抖。我看到了，他的手在抖。', emotion: '幾乎在自言自語' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '攻擊動機而非不在場，讓林威廉心理防線鬆動', because: '不在場可以偽造，但恨意無法假裝不存在' },
      { char: '管家林威廉', intent: '第一次真正動搖', because: '被點中要害讓他短暫失去計算能力' },
      { char: '繼承人蘇艾倫', intent: '開始懷疑林威廉', because: '恐懼從「被懷疑」轉向「我旁邊站著兇手」' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 4, fear: 8, trust: 3 }, c: { anger: 6, fear: 9, trust: 1 } },
  },
  evidence: {
    narration: '陳修遠把那個信封放在桌上，沒有說話。林威廉的眼睛在信封上停了兩秒，然後強迫移開。這個動作讓所有人都看見了。',
    lines: [
      { char: 'a', line: '這封信你見過。而且你見過不只一次。', emotion: '確定，不是疑問' },
      { char: 'b', line: '（非常長的沉默）……我不知道你在說什麼。', emotion: '防線已開始鬆動' },
      { char: 'c', line: '（往後退）他的眼睛動了。你們都看到了嗎？他的眼睛動了。', emotion: '緊盯著林威廉' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '用遺書逼迫林威廉承認知情', because: '物證比語言更有力' },
      { char: '管家林威廉', intent: '第一次出現明顯遲疑', because: '信封的存在是他沒預料到的' },
      { char: '繼承人蘇艾倫', intent: '開始主動觀察林威廉的反應', because: '她意識到嫌疑不在自己身上' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 5, fear: 8, trust: 3 } },
  },
  breakdown: {
    narration: '蘇艾倫坐在地上，不知道什麼時候坐下去的。她的手捂著臉，肩膀在抖。林威廉往旁邊移了半步——像是要離她遠一點。',
    lines: [
      { char: 'c', line: '（從地上開口）我改了遺囑。我知道。但我沒有殺他。是有人在我之後，做了我沒做的事。', emotion: '精疲力竭的清醒' },
      { char: 'a', line: '我知道不是你。（轉向林威廉）所以只剩一個問題了。', emotion: '平靜' },
      { char: 'b', line: '（後退一步，碰到牆）……你們不能這樣對我。', emotion: '第一次顯露恐慌' },
    ],
    decisions: [
      { char: '繼承人蘇艾倫', intent: '坦承一切，把調查方向推向林威廉', because: '與其被動被揭穿，不如主動交代' },
      { char: '偵探陳修遠', intent: '接住蘇艾倫的坦白，立刻把壓力轉向林威廉', because: '時機剛好' },
      { char: '管家林威廉', intent: '防線從側翼被突破，開始真正恐慌', because: '他沒料到蘇艾倫會主動坦白' },
    ],
    emotions: { a: { anger: 4, fear: 1, trust: 4 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 3, fear: 7, trust: 4 } },
  },
  escape_attempt: {
    narration: '黑暗中，有腳步聲朝著門口移動。陳修遠在停電前就數好了每個人的位置，他靠著直覺攔在門口。燈光亮起時，林威廉就站在他面前。',
    lines: [
      { char: 'a', line: '（沉聲）你要去哪裡？', emotion: '堵在門口，不動' },
      { char: 'b', line: '我……保險絲箱在走廊，我是去——', emotion: '解釋，但沒有後續' },
      { char: 'c', line: '（顫聲）保險絲箱在地下室。不在走廊。我知道，我在這裡住了二十年。', emotion: '說出關鍵的一句話' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '利用黑暗預判林威廉的行動', because: '有意圖逃跑的人才會在停電時往門口走' },
      { char: '管家林威廉', intent: '試圖趁停電離開，謊言被拆穿', because: '慌亂讓他說出地點錯誤的藉口' },
      { char: '繼承人蘇艾倫', intent: '無意中提供了最關鍵的反駁', because: '她對房子的熟悉程度超過林威廉的預期' },
    ],
    emotions: { a: { anger: 5, fear: 2, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 8, trust: 3 } },
  },
}

// ─── Endings ──────────────────────────────────────────────────────────────────

const CLIMAX = {
  default: {
    narration: '陳修遠從口袋裡取出一枚領帶別針，放在桌上——金色，上面刻著字。林威廉的臉在那一刻失去了所有顏色。',
    lines: [
      { char: 'a', line: '這枚別針在死者手裡找到的。林先生，這是您的吧？', emotion: '平靜，像刀刃' },
      { char: 'b', line: '這……這不可能。我的別針一直……（沉默）', emotion: '崩潰' },
      { char: 'c', line: '天啊。（退後一步）天啊，原來是你。', emotion: '恐懼與恍悟' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '亮出物證，一舉擊潰防線', because: '時機成熟' },
      { char: '管家林威廉', intent: '防線徹底崩潰', because: '物證是無法用語言消解的' },
      { char: '繼承人蘇艾倫', intent: '意識到自己一直和兇手站在同一個房間', because: '比被懷疑更可怕' },
    ],
    emotions: { a: { anger: 5, fear: 1, trust: 3 }, b: { anger: 6, fear: 10, trust: 1 }, c: { anger: 5, fear: 10, trust: 2 } },
  },
  evidence: {
    narration: '信封攤開在桌上。裡面的字跡清晰，死者用顫抖的手寫下了一個名字，然後在名字下面畫了一條線。林威廉看著那個名字，長時間沒有說話。',
    lines: [
      { char: 'a', line: '（把信紙推向林威廉）這是你的名字。他知道是你。他留下來了。', emotion: '冷靜' },
      { char: 'b', line: '（極輕）他……他怎麼知道。（更輕）他一直都知道。', emotion: '不是在問，是在說給自己聽' },
      { char: 'c', line: '（捂住嘴）叔叔……他一個人扛著這件事到最後。', emotion: '眼眶泛紅' },
    ],
    decisions: [
      { char: '偵探陳修遠', intent: '讓遺書說話，自己退到後面', because: '有時候沉默比逼問更有力量' },
      { char: '管家林威廉', intent: '三十年的對抗在這一刻有了答案——死者早就知道了', because: '這個事實比被逮捕更讓他崩潰' },
      { char: '繼承人蘇艾倫', intent: '哀傷蓋過了恐懼', because: '她終於想起了叔叔這個人，而不只是遺產' },
    ],
    emotions: { a: { anger: 3, fear: 2, trust: 4 }, b: { anger: 3, fear: 9, trust: 2 }, c: { anger: 2, fear: 6, trust: 5 } },
  },
  breakdown: {
    narration: '林威廉靠著牆坐了下去。沒有戲劇性，沒有掙扎，像一個終於可以卸下重量的人。蘇艾倫還在哭，但聲音已經小了很多。',
    lines: [
      { char: 'b', line: '（坐在地上，聲音很平）他說他要把我趕走。三十年。三十年後，他說要把我趕走。', emotion: '空洞的平靜' },
      { char: 'a', line: '我知道。（蹲下來，和他同樣高度）但這不是你殺他的理由。', emotion: '不是在指責，更像是陳述' },
      { char: 'c', line: '（抬頭，看著林威廉）……你應該早點說的。', emotion: '說不清是憤怒還是憐憫' },
    ],
    decisions: [
      { char: '管家林威廉', intent: '說出一直沒說的動機——不是恨，是被拋棄', because: '崩潰之後反而什麼都說得出口' },
      { char: '偵探陳修遠', intent: '第一次放下偵探的距離，以人的方式靠近他', because: '案子結束了，但他還是個人' },
      { char: '繼承人蘇艾倫', intent: '在憤怒和同情之間搖擺', because: '她也有不能說的秘密，所以她懂得一點' },
    ],
    emotions: { a: { anger: 2, fear: 2, trust: 5 }, b: { anger: 2, fear: 7, trust: 3 }, c: { anger: 4, fear: 5, trust: 4 } },
  },
  escape_attempt: {
    narration: '林威廉被堵在門口。他沒有再說話，只是看著陳修遠的眼睛，像是終於承認了一件事——他輸了，而且早就知道會輸。',
    lines: [
      { char: 'b', line: '（轉身，背對著門）……你是怎麼知道的。', emotion: '問的不是逃跑的事' },
      { char: 'a', line: '（停頓）你服侍他三十年。你比任何人都更了解他。也比任何人都更了解那棟房子每一條走廊。', emotion: '回答了一個不同的問題' },
      { char: 'c', line: '（靠著牆，不動）……我以後一個人住在這裡嗎。', emotion: '突然意識到一件事' },
    ],
    decisions: [
      { char: '管家林威廉', intent: '承認失敗，但問的是動機如何被看穿', because: '他想知道哪裡出了錯' },
      { char: '偵探陳修遠', intent: '回答了林威廉沒問出口的問題', because: '有時候真正想知道的是另一件事' },
      { char: '繼承人蘇艾倫', intent: '突然意識到自己繼承的不只是遺產，還有這個空蕩蕩的莊園', because: '結局降臨時，她想到的是以後' },
    ],
    emotions: { a: { anger: 3, fear: 2, trust: 4 }, b: { anger: 3, fear: 8, trust: 3 }, c: { anger: 3, fear: 6, trust: 4 } },
  },
}

const EPILOGUE = {
  narration: '遠處終於傳來車聲——警察到了。三個人都沒有移動，像是這個消息已經不再重要。壁爐的灰燼裡有火星短暫閃了一下，然後熄滅。',
  lines: [
    { char: 'b', line: '（極輕聲）我服侍他三十年。三十年，他從未說過一句謝謝。', emotion: '空洞' },
    { char: 'a', line: '我知道。但這不是你殺他的理由。', emotion: '疲憊' },
    { char: 'c', line: '（坐下，雙手捂臉）這一切……什麼時候才會結束？', emotion: '精疲力竭' },
  ],
  decisions: [
    { char: '管家林威廉', intent: '第一次說出壓抑的三十年', because: '防線崩潰後反而能說出真心話' },
    { char: '偵探陳修遠', intent: '不追打，讓對方自己說完', because: '有些真相需要安靜才能浮現' },
    { char: '繼承人蘇艾倫', intent: '精神耗盡，連自保的力氣都沒了', because: '一整夜的恐懼在這一刻完全釋放' },
  ],
  emotions: { a: { anger: 2, fear: 2, trust: 5 }, b: { anger: 2, fear: 7, trust: 3 }, c: { anger: 2, fear: 5, trust: 4 } },
}

// ─── Director intervention scripts ────────────────────────────────────────────

const DIRECTOR_SCRIPTS = {
  '突然停電': {
    flag: 'escape_attempt',
    narration: '燈光在一聲悶響後全部熄滅。黑暗像布幕一樣落下，三個人誰都沒有動——或者說，幾乎沒有。',
    lines: [
      { char: 'a', line: '（沉聲）誰都不准移動。', emotion: '警覺' },
      { char: 'b', line: '（在黑暗中）保險絲應該在地下室……我去——', emotion: '試圖離開' },
      { char: 'c', line: '不要讓他走！別讓他一個人去！', emotion: '尖叫' },
    ],
    effect: '停電讓林威廉試圖趁亂離開——這個舉動被所有人記住了。後續故事將走向「逃脫未遂」路線。',
    emotions: { a: { anger: 5, fear: 3, trust: 2 }, b: { anger: 3, fear: 9, trust: 2 }, c: { anger: 6, fear: 10, trust: 1 } },
  },
  '其中一人說謊': {
    flag: null,
    narration: '陳修遠停下腳步，把剛才聽到的話在腦海裡重放了一遍。有什麼地方不對——像拼圖裡一塊被強迫塞進去的碎片。',
    lines: [
      { char: 'a', line: '等等。你剛才說「九點半離開」——但你一分鐘前說的是「九點」。', emotion: '銳利' },
      { char: 'b', line: '我……我說錯了。是九點半，那天我記不太清楚。', emotion: '強行鎮定' },
      { char: 'c', line: '（倒抽一口氣）他說謊了。他一直在說謊。', emotion: '驚恐' },
    ],
    effect: '矛盾的時間線被公開指出，林威廉的壓力驟增。',
    emotions: { a: { anger: 4, fear: 1, trust: 2 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 7, fear: 9, trust: 1 } },
  },
  '門外傳來陌生腳步聲': {
    flag: 'escape_attempt',
    narration: '走廊上傳來腳步聲，緩慢而有節奏，在門口停下了。三個人同時轉頭——但門，沒有打開。',
    lines: [
      { char: 'c', line: '有人在外面。有人在聽我們說話。', emotion: '顫抖' },
      { char: 'a', line: '（走向門口）誰在那裡？', emotion: '戒備' },
      { char: 'b', line: '（沒有移動，目光卻飄向另一個方向）……也許是老宅的聲音，這棟房子很老了。', emotion: '刻意平靜' },
    ],
    effect: '林威廉的目光飄向別處——他知道那是誰。後續故事將走向「逃脫未遂」路線。',
    emotions: { a: { anger: 4, fear: 3, trust: 2 }, b: { anger: 3, fear: 8, trust: 3 }, c: { anger: 5, fear: 10, trust: 1 } },
  },
  '有人發現密室中的遺書': {
    flag: 'evidence',
    narration: '蘇艾倫從書架後面抽出一個信封，上面用老式鋼筆寫著：「若我死於非命，請交給——」後面的字被撕掉了。',
    lines: [
      { char: 'c', line: '這……這是叔叔的字跡。他知道會發生這件事。他早就知道。', emotion: '震驚' },
      { char: 'a', line: '（接過信封）信封被拆開過。而且不是今天拆的。', emotion: '沉著觀察' },
      { char: 'b', line: '（非常輕聲）那封信……不應該還在。', emotion: '失控的一瞬間' },
    ],
    effect: '林威廉不小心說出「不應該還在」——遺書的存在動搖了他的防線。後續故事將走向「物證」路線。',
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 9, trust: 2 } },
  },
  '警笛聲從遠處傳來': {
    flag: null,
    narration: '遠處傳來斷斷續續的警笛聲，在雪夜裡格外清晰。時間忽然變得很具體——它正在倒數。',
    lines: [
      { char: 'b', line: '（第一次表現出真正的緊張）警察……這麼快。', emotion: '慌亂' },
      { char: 'a', line: '大約還有十分鐘。十分鐘後你們說的每一句話都會變成正式紀錄。', emotion: '壓迫' },
      { char: 'c', line: '那我現在要說實話嗎？（看向林威廉）還是等一下再說？', emotion: '抉擇邊緣' },
    ],
    effect: '外部時間壓力讓所有人的算計都在加速。',
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 6, fear: 8, trust: 3 } },
  },
  '其中一人情緒突然崩潰': {
    flag: 'breakdown',
    narration: '沒有任何預兆。蘇艾倫的茶杯掉在地上，碎成幾片。然後她開始哭——壓抑很久的那種，沒有眼淚，只有聲音。',
    lines: [
      { char: 'c', line: '我改了遺囑！好，我說了！我改了遺囑，叔叔發現了，但我沒有殺他！我沒有！', emotion: '崩潰' },
      { char: 'a', line: '（靜靜等她說完）我知道不是你。', emotion: '平靜' },
      { char: 'b', line: '（臉色變得非常難看）……', emotion: '沉默，眼神不對' },
    ],
    effect: '蘇艾倫主動坦承遺囑的事，把調查方向完全指向林威廉。後續故事將走向「崩潰」路線。',
    emotions: { a: { anger: 3, fear: 1, trust: 4 }, b: { anger: 5, fear: 10, trust: 1 }, c: { anger: 3, fear: 7, trust: 5 } },
  },
  '兩人發生激烈肢體衝突': {
    flag: 'breakdown',
    narration: '林威廉的手突然抓住了陳修遠的衣領。這個動作讓所有人都愣住了——三十年的隱忍，在這一秒撕開了一個口。',
    lines: [
      { char: 'b', line: '你以為你是誰？（聲音在顫）你以為真相能改變什麼？', emotion: '憤怒崩潰' },
      { char: 'a', line: '（沒有反抗，平靜看著他）能。對你不行，對其他人行。', emotion: '冰冷' },
      { char: 'c', line: '（尖叫）住手！（試圖拉開）住手！', emotion: '驚恐' },
    ],
    effect: '林威廉的衝動讓他徹底失去理智上的優勢。後續故事將走向「崩潰」路線。',
    emotions: { a: { anger: 5, fear: 2, trust: 2 }, b: { anger: 10, fear: 9, trust: 1 }, c: { anger: 7, fear: 10, trust: 1 } },
  },
  '有人突然失聲痛哭': {
    flag: 'breakdown',
    narration: '沒有人知道是從哪一刻開始的——蘇艾倫坐在角落，臉埋在膝蓋裡，哭聲像從很遠的地方傳來的。',
    lines: [
      { char: 'c', line: '（哭聲中）我只是不想失去那份遺產。我只是……我只是很害怕。', emotion: '真實的脆弱' },
      { char: 'a', line: '（輕聲）我知道。', emotion: '沉默地站在旁邊' },
      { char: 'b', line: '（轉頭，看向窗外，背對兩人）……', emotion: '無法面對' },
    ],
    effect: '哭聲讓房間裡某些東西鬆開了。後續故事將走向「崩潰」路線。',
    emotions: { a: { anger: 3, fear: 1, trust: 4 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 3, fear: 8, trust: 4 } },
  },
  '死者的日記被發現': {
    flag: 'evidence',
    narration: '日記夾在書架最高層，一本普通的黑色封面。翻開最後一頁，日期是三天前，字跡很亂，但最後一行清晰：「他今晚會來。」',
    lines: [
      { char: 'a', line: '（讀出聲音）「他今晚會來。我不打算逃。」（放下日記）他在等你。', emotion: '平靜的重量' },
      { char: 'b', line: '（長時間沉默）……他從來沒有逃過任何事。', emotion: '說的像是在緬懷' },
      { char: 'c', line: '（哽咽）叔叔知道……叔叔一直知道。', emotion: '哀傷' },
    ],
    effect: '日記揭示死者預知危險卻選擇等待——林威廉的防線從內部開始崩潰。後續故事將走向「物證」路線。',
    emotions: { a: { anger: 4, fear: 1, trust: 3 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 3, fear: 7, trust: 4 } },
  },
  '外頭暴雨來襲': {
    flag: null,
    narration: '雪停了。取而代之的是暴雨，打在窗上像無數個細小的拳頭。燈光閃了一下，維持住了。沒有人說話，三個人都聽著那個聲音。',
    lines: [
      { char: 'c', line: '（輕聲）雨……這個時候怎麼會下雨。', emotion: '困惑中有一種奇異的平靜' },
      { char: 'a', line: '（看著窗外）警察的車會慢一點。', emotion: '思考' },
      { char: 'b', line: '（沒有說話，輕輕閉上了眼睛）', emotion: '某種解脫還是絕望，看不出來' },
    ],
    effect: '雨延遲了外援，時間的壓力改變了方向。',
    emotions: { a: { anger: 3, fear: 2, trust: 3 }, b: { anger: 3, fear: 8, trust: 3 }, c: { anger: 4, fear: 7, trust: 3 } },
  },
}

// Generic fallback for unrecognized interventions
const GENERIC_INTERVENTION = [
  {
    narration: '某件事在這個時刻突然發生，改變了房間裡的重力。沒有人預料到。',
    lines: [
      { char: 'a', line: '（停下）這改變了一些事。', emotion: '重新計算' },
      { char: 'b', line: '（按捺，沒有說話）', emotion: '隱忍' },
      { char: 'c', line: '現在怎麼辦？告訴我現在怎麼辦。', emotion: '依賴' },
    ],
    effect: '突發事件讓局勢出現新的變量。',
    emotions: { a: { anger: 4, fear: 2, trust: 2 }, b: { anger: 4, fear: 9, trust: 2 }, c: { anger: 5, fear: 9, trust: 2 } },
  },
  {
    narration: '有些事情一旦發生，就再也無法假裝沒看見。三個人都知道這一點。',
    lines: [
      { char: 'a', line: '有意思。這讓情況複雜了一點。', emotion: '分析' },
      { char: 'c', line: '（退後一步）這不是我造成的。', emotion: '防衛' },
      { char: 'b', line: '也許我們應該先冷靜下來。', emotion: '強迫鎮定' },
    ],
    effect: '事件讓三人重新評估彼此的立場。',
    emotions: { a: { anger: 4, fear: 2, trust: 2 }, b: { anger: 4, fear: 8, trust: 2 }, c: { anger: 6, fear: 9, trust: 1 } },
  },
]

// ─── Generic fallback for custom characters ───────────────────────────────────

const GENERIC_NARRATIONS = [
  '沉默在房間裡蔓延，空氣因緊繃而凝固。',
  '某個東西在氣氛中繃緊，像快要斷裂的弦。',
  '沒有人願意先開口，每個人都在等別人暴露更多。',
  '時間以奇怪的方式緩慢流動，每一秒都帶著重量。',
  '燈光在某個瞬間閃了一下，然後恢復。',
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

// ─── Main generation function ─────────────────────────────────────────────────

function generateLocal(systemPrompt, intervention) {
  const hasIntervention = intervention &&
    !intervention.includes('繼續推進') &&
    !intervention.includes('只輸出JSON')

  const isDefault = isDefaultStory(systemPrompt)

  // ── Director intervention ──
  if (hasIntervention) {
    if (isDefault) {
      const key = Object.keys(DIRECTOR_SCRIPTS).find(k => intervention.includes(k))
      const script = key ? DIRECTOR_SCRIPTS[key] : pick(GENERIC_INTERVENTION)

      // Set ending flag if this intervention has one
      if (key && DIRECTOR_SCRIPTS[key].flag && !_ending) {
        _ending = DIRECTOR_SCRIPTS[key].flag
        _flags.add(_ending)
      }

      return {
        narration: script.narration,
        lines: script.lines,
        decisions: script.lines.map(l => ({ char: l.char, intent: '對突發事件反應', because: '導演指令觸發' })),
        director_effect: script.effect || `導演指令「${intervention}」已觸發。`,
        emotions: script.emotions,
      }
    }

    // Generic characters — simple intervention
    const generic = pick(GENERIC_INTERVENTION)
    const ids = extractCharIds(systemPrompt)
    const cur = extractEmotions(systemPrompt)
    const newEm = {}
    for (const id of ids) {
      const e = cur[id] || { anger: 3, fear: 3, trust: 5 }
      newEm[id] = { anger: clamp(e.anger + 1), fear: clamp(e.fear + 1), trust: clamp(e.trust - 1) }
    }
    return {
      narration: generic.narration,
      lines: generic.lines.filter(l => ids.includes(l.char)),
      decisions: [],
      director_effect: `導演指令「${intervention}」已觸發。`,
      emotions: newEm,
    }
  }

  // ── Scripted story progression ──
  if (isDefault) {
    // Opening (rounds 0–2)
    if (_round < OPENING_BEATS.length) {
      const beat = OPENING_BEATS[_round++]
      return { ...beat, director_effect: '' }
    }

    // Mid-section (round 3) — branching based on flags
    if (_round === OPENING_BEATS.length) {
      _round++
      const path = _ending || 'default'
      const beat = MID_BEATS[path] || MID_BEATS.default
      return { ...beat, director_effect: '' }
    }

    // Climax (round 4) — branching ending
    if (_round === OPENING_BEATS.length + 1) {
      _round++
      const path = _ending || 'default'
      const beat = CLIMAX[path] || CLIMAX.default
      return { ...beat, director_effect: '' }
    }

    // Epilogue (round 5+)
    _round++
    return { ...EPILOGUE, director_effect: '' }
  }

  // ── Generic characters ──
  const ids = extractCharIds(systemPrompt)
  const cur = extractEmotions(systemPrompt)
  const count = Math.random() < 0.35 ? 1 : Math.random() < 0.6 ? 2 : Math.min(3, ids.length)
  const speakers = [...ids].sort(() => Math.random() - 0.5).slice(0, count)
  const newEm = {}
  for (const id of ids) {
    const e = cur[id] || { anger: 3, fear: 3, trust: 5 }
    newEm[id] = { anger: clamp(e.anger + (Math.random() < 0.5 ? 1 : -1)), fear: clamp(e.fear + (Math.random() < 0.5 ? 1 : -1)), trust: clamp(e.trust + (Math.random() < 0.5 ? 1 : -1)) }
  }
  return {
    narration: pick(GENERIC_NARRATIONS),
    lines: speakers.map(id => { const e = cur[id] || { anger: 3, fear: 3, trust: 5 }; return { char: id, line: genericLine(e), emotion: emotionLabel(e) } }),
    decisions: [],
    director_effect: '',
    emotions: newEm,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function callClaude(messages, systemPrompt = '', options = {}) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const intervention = lastUser?.content || '繼續推進對話'
  const engine = options.engine || 'claude-code'

  if (engine === 'local') {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 400))
    const payload = generateLocal(systemPrompt, intervention)
    return { parsed: payload, raw: JSON.stringify(payload) }
  }

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
