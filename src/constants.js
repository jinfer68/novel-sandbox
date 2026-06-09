export const TIMER_MAX = 30

export const ENGINE_TIMER_MAX = {
  'claude-code': 45,
  codex: 30,
  local: 10,
}

export const CHAR_IDS = ['a', 'b', 'c']

export const CHAR_COLORS = {
  a: '#e07040',
  b: '#6080d0',
  c: '#50a878',
}

export const DEFAULT_CHARS = {
  a: {
    name: '偵探陳修遠',
    trait: '冷靜多疑、習慣說謊',
    goal: '查出真相，同時隱瞞自己與死者的關係',
    relation: '與死者是舊情人，與林威廉初次見面，對蘇艾倫半信半疑',
    secret: '認識死者，是舊情人',
    tone: '簡短、反問、帶諷刺',
    notes: '習慣先觀察矛盾再逼問，不會立刻公開自己的推理。',
  },
  b: {
    name: '管家林威廉',
    trait: '過度禮貌、內藏恨意',
    goal: '將嫌疑轉移給蘇艾倫，保住自己的不在場證明',
    relation: '服侍死者三十年，暗中憎恨，對蘇艾倫知道太多感到威脅',
    secret: '才是兇手，有不在場證明',
    tone: '謙遜精確、偶爾滑脫',
    notes: '熟悉莊園所有動線，會用禮貌掩飾控制欲。',
  },
  c: {
    name: '繼承人蘇艾倫',
    trait: '衝動情緒化、表面天真',
    goal: '掩蓋改遺囑的事，同時找出真正的兇手',
    relation: '是死者的姪女，懼怕林威廉知道秘密，對偵探又依賴又不信任',
    secret: '偷改遺囑，死者發現了',
    tone: '聲音顫抖、問句多、易失控',
    notes: '外表脆弱但求生欲很強，遇到逼問時可能反咬他人。',
  },
}

export const DEFAULT_SCENE =
  '謀殺案剛發生。三人被困在莊園密室，大雪封路，兇器消失，互相懷疑。'

export const DEFAULT_WORLD = {
  premise: '一場封閉空間中的謀殺案，角色各自帶著不能說出口的秘密。',
  genre: '推理懸疑',
  location: '大雪封路的莊園密室',
  era: '近現代',
  atmosphere: '封閉、猜忌、壓迫',
  rules: ['大雪封路，任何人暫時不能離開莊園', '秘密不會輕易公開，只會透過矛盾與失控逐步露出'],
  factions: ['調查真相的人', '想掩蓋罪行的人', '試圖保住遺產的人'],
  conflicts: ['兇手身份不明', '遺囑與繼承權引發互相懷疑'],
  secrets: ['每個角色都知道部分真相，但都沒有說完整'],
  timeline: ['謀殺案剛發生', '眾人被困在現場', '兇器消失'],
  director_notes: '旁白可以揭露氣氛與動作，但不要替角色直接說出秘密。',
}

export const DEFAULT_EMOTIONS = {
  a: { anger: 3, fear: 2, trust: 4 },
  b: { anger: 1, fear: 7, trust: 6 },
  c: { anger: 6, fear: 8, trust: 1 },
}

export const DIRECTOR_CMDS_POOL = [
  // 環境事件
  '突然停電，室內陷入黑暗',
  '門外傳來陌生腳步聲',
  '警笛聲從遠處傳來',
  '窗外有人影一閃而過',
  '遠處傳來一聲槍響',
  '屋內某處突然起火冒煙',
  '電話鈴聲突然響起',
  '外頭暴雨來襲，雷聲轟隆',
  '有人推開門闖入房間',
  '燈光忽明忽暗，電力不穩',
  // 物件發現
  '有人發現密室中的遺書',
  '地板下藏著一個鎖著的箱子',
  '口袋裡掉出一張陌生的紙條',
  '牆上出現了血跡',
  '有人發現兇器就在房間裡',
  '一封不知從哪來的信被推進來',
  '發現死者手機，螢幕有未讀訊息',
  '角落的保險箱突然被人打開',
  // 人物衝突
  '其中一人說謊，被當場抓包',
  '其中一人情緒突然崩潰',
  '兩人發生激烈肢體衝突',
  '有人突然失聲痛哭',
  '某角色突然宣稱自己知道兇手是誰',
  '某角色突然威脅其他人',
  '有人開始獨自在房間角落喃喃自語',
  '某角色試圖獨自逃離現場',
  // 資訊揭露
  '有人透露了一個一直隱瞞的秘密',
  '手機收到一則身份不明的威脅訊息',
  '有人找到了能證明不在場的關鍵證據',
  '死者的日記被發現，某頁被撕掉',
  '監視器錄像顯示出乎意料的畫面',
  '有人突然認出另一人的真實身份',
  // 心理壓力
  '有人宣稱自己就快撐不住了',
  '時間壓力驟增，外援遲遲未到',
  '有人開始懷疑這整件事是一場局',
  '某角色意識到自己也可能是目標',
]

// 從池子中隨機抽取 n 個，不重複
export function pickDirectorCmds(n = 4, exclude = []) {
  const pool = DIRECTOR_CMDS_POOL.filter(c => !exclude.includes(c))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// 保留向後相容
export const DIRECTOR_CMDS = DIRECTOR_CMDS_POOL.slice(0, 6)

export const T = {
  bg: '#0a0a0f',
  bg2: '#111118',
  bg3: '#18181f',
  border: 'rgba(255,255,255,.08)',
  border2: 'rgba(255,255,255,.14)',
  text: '#e8e6e0',
  text2: '#888680',
  text3: '#55534f',
  accent: '#c8a96e',
  red: '#e74c3c',
  teal: '#2ecc9a',
  amber: '#f39c12',
}
