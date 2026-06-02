import { useState } from 'react'
import { CHAR_COLORS, DEFAULT_CHARS, DEFAULT_SCENE, DEFAULT_WORLD, DEFAULT_EMOTIONS, T } from '../constants.js'

const ENGINE_OPTIONS = [
  { id: 'claude-code', label: 'Claude Code', desc: '外部 Claude Code worker 即時生成' },
  { id: 'codex', label: 'Codex', desc: '啟動 codex-worker 後自動生成' },
  { id: 'local', label: 'Local', desc: '本地規則引擎，測試 UI 流程用' },
]

const FIELD_HINTS = {
  trait: ['性格', '個性', '特質'],
  goal: ['目的', '目標', '想要'],
  relation: ['關係', '人際', '立場'],
  secret: ['秘密', '隱瞞', '真相'],
  tone: ['語氣', '口吻', '說話'],
  notes: ['補充設定', '細節', '其他'],
}
const CHARACTER_MARKERS = /性格|個性|特質|目的|目標|想要|秘密|隱瞞|真相|語氣|口吻|說話|關係|人際|立場|身份|職業|角色|人物|姓名|名字/
const CHARACTER_START = /(?:^|[\n。；;])\s*[-*•\d.、\s]*(?:角色|人物)?\s*([^：:\n。；;，,、]{1,32})[：:]\s*(?=[^。；;\n]*(?:性格|個性|特質|目的|目標|想要|秘密|隱瞞|真相|語氣|口吻|說話|關係|身份|職業|角色|人物))/g
const ROLE_LABEL = /^(?:角色|人物|姓名|名字|主要角色|登場人物|角色設定)(?:\s*[A-ZＡ-Ｚa-z一二三四五六七八九十\d]+)?\s*[：:]?\s*/
const FIELD_LINE = /^(?:性格|個性|特質|目的|目標|想要|關係|人際|立場|秘密|隱瞞|真相|語氣|口吻|說話|身份|職業)\s*[：:]/
const WORLD_LINE = /^(?:世界觀|故事|場景|背景|規則|勢力|派系|時間線|核心衝突|衝突|秘密|氣氛|地點|時代)\s*[：:]/
const SECTION_LINE = /^[#＃*\-\s]*[【\[]?(?:角色|人物|登場人物|角色設定|主要角色)[】\]]?\s*[：:]?\s*$/
const STRICT_ROLE_START = /^-{3,}\s*角色\s*-{3,}$/i
const STRICT_ROLE_END = /^-{3,}\s*結束角色\s*-{3,}$/i
const STRICT_WORLD_START = /^-{3,}\s*世界觀\s*-{3,}$/i
const STRICT_WORLD_END = /^-{3,}\s*結束世界觀\s*-{3,}$/i
const STRICT_FIELD_LABELS = {
  name: ['姓名', '名字', '名稱', '角色名', '角色姓名', 'name', 'Name'],
  trait: ['性格', '個性', '特質'],
  goal: ['目的', '目標', '想要', '動機', '短期目標', '長期目標'],
  relation: ['關係', '人際', '立場', '同盟', '敵人', '依附', '衝突對象'],
  secret: ['秘密', '隱瞞', '真相', '不可說', '罪行', '把柄'],
  tone: ['語氣', '口吻', '說話', '台詞風格', '語言習慣'],
  notes: ['身份', '職業', '背景', '能力', '弱點', '限制', '價值觀', '創傷', '行動原則', '習慣', '補充設定', '細節', '其他'],
}
const WORLD_HINTS = {
  location: /莊園|密室|王宮|宮廷|城市|村莊|學校|醫院|星艦|殖民地|基地|森林|沙漠|島|監獄|劇院|車站/,
  era: /古代|中世紀|現代|近未來|未來|架空|王國|帝國|末日|戰後|民國|昭和|賽博|蒸汽/,
  conflict: /謀殺|死亡|失蹤|內戰|繼承|背叛|陰謀|危機|封鎖|入侵|叛亂|詛咒|追殺|勒索|審判/,
  rule: /規則|法律|禁忌|不能|不可|必須|只有|一旦|代價|限制|約定/,
  faction: /勢力|派系|家族|軍方|教會|貴族|公司|組織|幫派|警察|議會|反抗軍|王室/,
  secret: /秘密|隱瞞|真相|偽造|背後|其實|沒有人知道|被掩蓋|謊言/,
  timeline: /年前|年後|昨日|昨夜|剛剛|稍早|當晚|黎明|深夜|過去|之後|之前|第[一二三四五六七八九十\d]+天/,
}

function nextId(chars) {
  const used = new Set(Object.keys(chars))
  for (let i = 0; i < 26; i += 1) {
    const id = String.fromCharCode(97 + i)
    if (!used.has(id)) return id
  }
  return `x${Date.now()}`
}

function colorFor(id) {
  return CHAR_COLORS[id] || ['#e07040', '#6080d0', '#50a878', '#c8a96e', '#d06090', '#7aa060'][Math.abs(id.charCodeAt(0) || 0) % 6]
}

function emptyChar(id) {
  return {
    name: `角色${id.toUpperCase()}`,
    trait: '',
    goal: '',
    relation: '',
    secret: '',
    tone: '',
    notes: '',
  }
}

function pickField(text, key) {
  const labels = FIELD_HINTS[key]
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[：:]?\\s*([^。；;，,\\n]+)`))
    if (match) return match[1].trim()
  }
  return ''
}

function cleanName(value) {
  return String(value || '')
    .replace(ROLE_LABEL, '')
    .replace(/^[【\[]|[】\]]$/g, '')
    .replace(/^(?:姓名|名字)\s*[：:]/, '')
    .replace(/[，,、。；;：:].*$/, '')
    .trim()
}

function cleanFieldValue(value) {
  return String(value || '').replace(/^[^：:]{1,8}[：:]\s*/, '').trim()
}

function sectionBetween(text, startPattern, endPattern) {
  const lines = text.split(/\n/)
  const body = []
  let active = false
  let found = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (startPattern.test(trimmed)) {
      active = true
      found = true
      continue
    }
    if (active && endPattern.test(trimmed)) break
    if (active) body.push(line)
  }

  return found ? body.join('\n').trim() : ''
}

function textOutsideStrictRoleSection(text) {
  const lines = text.split(/\n/)
  const kept = []
  let inRole = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (STRICT_ROLE_START.test(trimmed)) {
      inRole = true
      continue
    }
    if (inRole && STRICT_ROLE_END.test(trimmed)) {
      inRole = false
      continue
    }
    if (!inRole) kept.push(line)
  }
  return kept.join('\n').trim()
}

function cleanSectionMarkers(text) {
  return String(text || '')
    .split(/\n/)
    .filter(line => {
      const trimmed = line.trim()
      return !STRICT_WORLD_START.test(trimmed)
        && !STRICT_WORLD_END.test(trimmed)
        && !STRICT_ROLE_START.test(trimmed)
        && !STRICT_ROLE_END.test(trimmed)
    })
    .join('\n')
    .trim()
}

function labelKey(label) {
  const normalized = label.trim()
  for (const [key, labels] of Object.entries(STRICT_FIELD_LABELS)) {
    if (labels.includes(normalized)) return key
  }
  return null
}

function appendField(target, key, value) {
  if (!value) return
  if (key === 'name') {
    target.name = cleanName(value)
    return
  }
  target[key] = target[key] ? `${target[key]}；${value}` : value
}

function parseStrictCharacters(text) {
  const strictText = sectionBetween(text, STRICT_ROLE_START, STRICT_ROLE_END)
  if (!strictText) return []

  const blocks = strictText
    .split(/\n(?=角色\s*[：:])/)
    .map(block => block.trim())
    .filter(Boolean)

  return blocks.map((block, index) => {
    const character = {
      name: '',
      trait: '',
      goal: '',
      relation: '',
      secret: '',
      tone: '',
      notes: '',
    }
    let currentKey = null

    block.split(/\n+/).forEach(rawLine => {
      const line = rawLine.trim()
      if (!line) return

      const roleLine = line.match(/^角色\s*[：:]\s*(.*)$/)
      if (roleLine) {
        const inlineName = cleanName(roleLine[1])
        if (inlineName) character.name = inlineName
        currentKey = null
        return
      }

      const field = line.match(/^([^：:]{1,12})\s*[：:]\s*(.*)$/)
      if (field) {
        const key = labelKey(field[1])
        if (key) {
          appendField(character, key, field[2].trim())
          currentKey = key
        } else if (!character.name && field[1].length <= 8 && !field[2]) {
          // "李曜：" with no value — treat label as name
          character.name = cleanName(field[1])
        }
        return
      }

      // Plain line with no colon: if name not yet found and line looks like a name (short, no punctuation)
      if (!character.name && !currentKey && line.length <= 20 && !/[。！？!?，,、；;]/.test(line)) {
        character.name = cleanName(line)
        return
      }

      if (currentKey && currentKey !== 'name') {
        appendField(character, currentKey, line.replace(/^[-*•]\s*/, ''))
      }
    })

    character.name = character.name || `角色${String.fromCharCode(65 + index)}`
    return character
  }).filter(c => c.name || c.trait || c.goal || c.secret)
}

function compactLines(value) {
  if (!value) return []
  return String(value)
    .split(/[\n,，、；;]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function listToText(list) {
  return Array.isArray(list) ? list.join('\n') : ''
}

function textToList(text) {
  return compactLines(text)
}

function sentenceList(text) {
  return String(text)
    .split(/(?<=[。！？!?])|\n+/)
    .map(s => s.trim().replace(/^[,，。；;\s]+/, ''))
    .filter(s => s.length > 4)
}

function firstMatch(sentences, pattern) {
  return sentences.find(s => pattern.test(s)) || ''
}

function uniqueMatches(sentences, pattern, limit = 5) {
  const seen = new Set()
  const hits = []
  for (const sentence of sentences) {
    if (!pattern.test(sentence)) continue
    const cleaned = sentence.replace(/[。！？!?]+$/, '').trim()
    if (seen.has(cleaned)) continue
    seen.add(cleaned)
    hits.push(cleaned)
    if (hits.length >= limit) break
  }
  return hits
}

function inferGenre(text) {
  const checks = [
    [/謀殺|偵探|兇手|密室|遺囑|案/, '推理懸疑'],
    [/王國|宮廷|王位|貴族|遺詔|王室|帝國/, '宮廷權謀'],
    [/星艦|殖民地|AI|人工智慧|外星|賽博|未來/, '科幻'],
    [/詛咒|魔法|神殿|龍|巫|精靈|異世界/, '奇幻'],
    [/校園|學生|社團|班級|老師/, '校園群像'],
    [/末日|感染|災難|避難|廢墟/, '末日生存'],
  ]
  return checks.find(([pattern]) => pattern.test(text))?.[1] || ''
}

function parseWorldText(text, sceneText) {
  const sentences = sentenceList(text)
  const location = firstMatch(sentences, WORLD_HINTS.location)
  const era = firstMatch(sentences, WORLD_HINTS.era)
  const conflicts = uniqueMatches(sentences, WORLD_HINTS.conflict)
  const secrets = uniqueMatches(sentences, WORLD_HINTS.secret)
  const rules = uniqueMatches(sentences, WORLD_HINTS.rule)
  const factions = uniqueMatches(sentences, WORLD_HINTS.faction)
  const timeline = uniqueMatches(sentences, WORLD_HINTS.timeline)
  const premise = sceneText || sentences.slice(0, 2).join('') || text.slice(0, 180)

  return {
    ...DEFAULT_WORLD,
    premise: premise || DEFAULT_WORLD.premise,
    genre: inferGenre(text) || DEFAULT_WORLD.genre,
    location: location || DEFAULT_WORLD.location,
    era: era || DEFAULT_WORLD.era,
    atmosphere: conflicts.length > 0 || secrets.length > 0 ? '緊張、猜忌、資訊不對稱' : DEFAULT_WORLD.atmosphere,
    rules: rules.length > 0 ? rules : DEFAULT_WORLD.rules,
    factions: factions.length > 0 ? factions : DEFAULT_WORLD.factions,
    conflicts: conflicts.length > 0 ? conflicts : DEFAULT_WORLD.conflicts,
    secrets: secrets.length > 0 ? secrets : DEFAULT_WORLD.secrets,
    timeline: timeline.length > 0 ? timeline : DEFAULT_WORLD.timeline,
  }
}

function splitCharacterLine(line) {
  const cleaned = line.replace(/^[-*•\d.、\s]+/, '').trim()
  if (SECTION_LINE.test(cleaned) || WORLD_LINE.test(cleaned)) return null

  const namedField = cleaned.match(/^(?:姓名|名字)\s*[：:]\s*(.{1,24})$/)
  if (namedField) return { name: cleanName(namedField[1]), body: '' }

  const unlabeled = cleaned.replace(ROLE_LABEL, '').trim()
  const target = unlabeled || cleaned

  const labelName = cleaned.match(/^(?:角色|人物|姓名|名字|主要角色|登場人物)(?:\s*[A-ZＡ-Ｚa-z一二三四五六七八九十\d]+)?\s*[：:]\s*([^，,、：:\n]{1,24})[，,、\s]*(.*)$/)
  if (labelName && (CHARACTER_MARKERS.test(labelName[2]) || labelName[2].length > 4)) {
    return { name: labelName[1].trim(), body: labelName[2].trim() || target }
  }

  const colon = cleaned.match(/^(.{1,32}?)[：:]\s*(.+)$/)
  if (colon && CHARACTER_MARKERS.test(colon[2])) {
    return { name: colon[1].trim(), body: colon[2].trim() }
  }

  const bracket = target.match(/^([^：:\n（）()]{1,20})[（(]([^）)]+)[）)]\s*[：:]?\s*(.*)$/)
  if (bracket && (CHARACTER_MARKERS.test(bracket[2]) || CHARACTER_MARKERS.test(bracket[3]) || bracket[3].length > 4)) {
    return { name: bracket[1].trim(), body: `${bracket[2]}；${bracket[3]}`.trim() }
  }

  const targetColon = target.match(/^(.{1,24}?)[：:]\s*(.+)$/)
  if (targetColon && (CHARACTER_MARKERS.test(targetColon[2]) || targetColon[2].length > 8)) {
    return { name: targetColon[1].trim(), body: targetColon[2].trim() }
  }

  const comma = target.match(/^([^：:\n，,、]{1,20})[，,、\s]+(.+)$/)
  if (comma && CHARACTER_MARKERS.test(comma[2]) && !WORLD_LINE.test(target)) {
    return { name: comma[1].trim(), body: comma[2].trim() }
  }

  const dash = target.match(/^(.{1,32}?)\s+[-—]\s+(.+)$/)
  if (dash && CHARACTER_MARKERS.test(dash[2])) {
    return { name: dash[1].trim(), body: dash[2].trim() }
  }

  return null
}

function collectCharacterBlocks(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const sceneLines = []
  const blocks = []
  let current = null
  let inCharacterSection = false

  const pushCurrent = () => {
    if (!current) return
    if (current.name && (current.body || current.hasFields)) {
      blocks.push(`${current.name}：${current.body}`.trim())
    }
    current = null
  }

  for (const line of lines) {
    if (SECTION_LINE.test(line)) {
      pushCurrent()
      inCharacterSection = true
      continue
    }

    if (current && (FIELD_LINE.test(line) || (inCharacterSection && CHARACTER_MARKERS.test(line)))) {
      current.body = `${current.body}；${line}`.replace(/^；/, '')
      current.hasFields = true
      continue
    }

    if (WORLD_LINE.test(line)) {
      pushCurrent()
      inCharacterSection = false
      sceneLines.push(line)
      continue
    }

    const roleMatch = splitCharacterLine(line)
    if (roleMatch) {
      pushCurrent()
      current = roleMatch
      continue
    }

    const nameOnly = line.replace(/^[-*•\d.、\s]+/, '').trim()
    if ((inCharacterSection || /^[-*•\d.、\s]+/.test(line)) && nameOnly.length <= 18 && !/[。！？!?]/.test(nameOnly) && /^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9·・\s]*$/u.test(nameOnly)) {
      pushCurrent()
      current = { name: nameOnly, body: '' }
      continue
    }

    pushCurrent()
    sceneLines.push(line)
  }

  pushCurrent()
  return { sceneText: sceneLines.join('\n'), characterLines: blocks }
}

function splitImportBlocks(text) {
  const collected = collectCharacterBlocks(text)
  if (collected.characterLines.length > 0) return collected

  const matches = [...text.matchAll(CHARACTER_START)]
  if (matches.length === 0) return collected

  return {
    sceneText: text.slice(0, matches[0].index).trim(),
    characterLines: matches.map((match, index) => {
      const start = match.index + match[0].length - match[1].length - 1
      const end = matches[index + 1]?.index ?? text.length
      return text.slice(start, end).replace(/^[\n。；;\s]+/, '').trim()
    }),
  }
}

function parseImportText(text) {
  const strictChars = parseStrictCharacters(text)
  const strictMode = strictChars.length > 0
  const parseSource = strictMode ? cleanSectionMarkers(textOutsideStrictRoleSection(text)) : text
  const { sceneText, characterLines } = strictMode
    ? { sceneText: parseSource, characterLines: [] }
    : splitImportBlocks(text)
  const lines = characterLines.length > 0
    ? characterLines
    : text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const sceneLines = []
  const parsedChars = {}
  const parsedEmotions = {}
  let index = 0

  if (sceneText) sceneLines.push(sceneText)

  for (const strictChar of strictChars) {
    const id = String.fromCharCode(97 + index)
    parsedChars[id] = strictChar
    parsedEmotions[id] = { anger: 3, fear: 3, trust: 4 }
    index += 1
  }

  for (const line of strictMode ? [] : lines) {
    const roleMatch = splitCharacterLine(line)
    if (!roleMatch) {
      sceneLines.push(line)
      continue
    }

    const id = String.fromCharCode(97 + index)
    const body = roleMatch.body
    parsedChars[id] = {
      name: cleanName(roleMatch.name) || `角色${id.toUpperCase()}`,
      trait: pickField(body, 'trait') || cleanFieldValue(body.split(/[。；;]/)[0]) || '',
      goal: pickField(body, 'goal'),
      relation: pickField(body, 'relation'),
      secret: pickField(body, 'secret'),
      tone: pickField(body, 'tone'),
      notes: pickField(body, 'notes'),
    }
    parsedEmotions[id] = { anger: 3, fear: 3, trust: 4 }
    index += 1
  }

  return {
    scene: sceneLines.join('\n') || text.slice(0, 240),
    world: parseWorldText(parseSource, sceneLines.join('\n')),
    chars: parsedChars,
    emotions: parsedEmotions,
  }
}

function CharCard({ id, data, emotions, onChange, onEmotion, onRemove, canRemove }) {
  const col = colorFor(id)
  const defaults = DEFAULT_CHARS[id] || emptyChar(id)
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderTop: `2px solid ${col}`, borderRadius: 8, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${col}22`, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
          {(data.name || '?')[0]}
        </div>
        <input
          value={data.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder={defaults.name}
          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: col, fontSize: 13, fontWeight: 600, padding: '0.2rem 0', outline: 'none' }}
        />
      </div>

      {[['性格', 'trait'], ['目的', 'goal'], ['與他人的關係', 'relation'], ['秘密', 'secret'], ['語氣', 'tone']].map(([lbl, k]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>{lbl}</div>
          <input
            value={data[k]}
            onChange={e => onChange(k, e.target.value)}
            placeholder={defaults[k]}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 12, padding: '0.2rem 0', outline: 'none' }}
          />
        </div>
      ))}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>補充設定</div>
        <textarea
          value={data.notes || ''}
          onChange={e => onChange('notes', e.target.value)}
          placeholder={defaults.notes || '身份、背景、能力、弱點、價值觀、創傷、行動原則等'}
          rows={3}
          style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, padding: '0.45rem', outline: 'none', resize: 'vertical', lineHeight: 1.55 }}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 9, color: T.text3, marginBottom: 6 }}>初始情緒</div>
        {[['怒', 'anger', T.red], ['懼', 'fear', T.amber], ['信', 'trust', T.teal]].map(([lbl, k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: T.text3, width: 16 }}>{lbl}</span>
            <input type="range" min={0} max={10} value={emotions[k]}
              onChange={e => onEmotion(k, parseInt(e.target.value))}
              style={{ flex: 1, accentColor: c, cursor: 'pointer' }} />
            <span style={{ fontSize: 9, color: T.text2, width: 12 }}>{emotions[k]}</span>
          </div>
        ))}
      </div>
      {canRemove && (
        <button onClick={onRemove}
          style={{ width: '100%', marginTop: 8, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 5, color: T.text3, padding: '0.35rem', fontSize: 10, cursor: 'pointer' }}>
          移除角色
        </button>
      )}
    </div>
  )
}

function WorldCard({ world, onChange }) {
  const textField = (key, value) => onChange(key, value)
  const listField = (key, value) => onChange(key, textToList(value))

  const inputStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${T.border}`,
    color: T.text,
    fontSize: 12,
    padding: '0.25rem 0',
    outline: 'none',
  }

  const labelStyle = { fontSize: 9, color: T.text3, marginBottom: 3 }

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 10 }}>世界觀卡</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
        {[['類型', 'genre'], ['地點', 'location'], ['時代', 'era'], ['氣氛', 'atmosphere']].map(([label, key]) => (
          <div key={key}>
            <div style={labelStyle}>{label}</div>
            <input value={world[key] || ''} onChange={e => textField(key, e.target.value)} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>核心前提</div>
        <textarea value={world.premise || ''} rows={2}
          onChange={e => textField('premise', e.target.value)}
          style={{ ...inputStyle, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0.55rem', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {[
          ['世界規則', 'rules'],
          ['勢力/群體', 'factions'],
          ['核心衝突', 'conflicts'],
          ['世界秘密', 'secrets'],
          ['時間線', 'timeline'],
          ['導演備註', 'director_notes'],
        ].map(([label, key]) => (
          <div key={key}>
            <div style={labelStyle}>{label}</div>
            <textarea value={key === 'director_notes' ? (world[key] || '') : listToText(world[key])} rows={key === 'director_notes' ? 2 : 3}
              onChange={e => key === 'director_notes' ? textField(key, e.target.value) : listField(key, e.target.value)}
              style={{ ...inputStyle, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0.55rem', resize: 'vertical', lineHeight: 1.55 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Setup({ onStart }) {
  const [scene, setScene] = useState(DEFAULT_SCENE)
  const [world, setWorld] = useState({ ...DEFAULT_WORLD })
  const [chars, setChars] = useState({ a: { ...DEFAULT_CHARS.a }, b: { ...DEFAULT_CHARS.b }, c: { ...DEFAULT_CHARS.c } })
  const [em, setEm] = useState({ a: { ...DEFAULT_EMOTIONS.a }, b: { ...DEFAULT_EMOTIONS.b }, c: { ...DEFAULT_EMOTIONS.c } })
  const [engine, setEngine] = useState('local')
  const [importText, setImportText] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [importedNames, setImportedNames] = useState([])

  const setChar = (id, k, v) => setChars(p => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const setE = (id, k, v) => setEm(p => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const setWorldField = (key, value) => setWorld(p => ({ ...p, [key]: value }))
  const charIds = Object.keys(chars)

  const addChar = () => {
    const id = nextId(chars)
    setChars(p => ({ ...p, [id]: emptyChar(id) }))
    setEm(p => ({ ...p, [id]: { anger: 3, fear: 3, trust: 4 } }))
  }

  const removeChar = (id) => {
    setChars(p => {
      const next = { ...p }
      delete next[id]
      return next
    })
    setEm(p => {
      const next = { ...p }
      delete next[id]
      return next
    })
  }

  const handleImport = () => {
    if (!importText.trim()) return
    const parsed = parseImportText(importText.trim())
    if (parsed.scene) setScene(parsed.scene)
    if (parsed.world) setWorld(parsed.world)
    if (Object.keys(parsed.chars).length > 0) {
      setChars(parsed.chars)
      setEm(parsed.emotions)
      setImportedNames(Object.values(parsed.chars).map(c => c.name))
      setImportStatus(`已套用 ${Object.keys(parsed.chars).length} 位角色`)
    } else {
      setImportedNames([])
      setImportStatus('沒有辨識到角色；請使用 ---角色--- 區段，且每位角色用「角色：」開頭')
    }
  }

  const handleStart = () => {
    onStart(scene || DEFAULT_SCENE, chars, em, engine, world)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: T.accent, marginBottom: 4 }}>NOVEL SANDBOX MVP</div>
        <div style={{ fontSize: 'clamp(1.8rem,5vw,3rem)', fontWeight: 700, color: T.text, letterSpacing: '0.05em', lineHeight: 1 }}>靈感培養皿</div>
        <div style={{ fontSize: 11, color: T.text2, marginTop: 6 }}>設定世界觀與角色，然後放手觀看</div>
      </div>

      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 8 }}>文字匯入</div>
          <textarea value={importText} rows={5}
            onChange={e => setImportText(e.target.value)}
            placeholder={'建議使用嚴格格式，避免誤讀：\n---世界觀---\n核心前提：架空王國內戰前夜，女王暴斃。\n世界規則：王宮封鎖前沒有人能離開。\n---結束世界觀---\n\n---角色---\n角色：李曜\n姓名：李曜\n身份：宰相\n性格：謹慎、溫和\n目的：扶植傀儡繼承人\n秘密：偽造遺詔\n語氣：禮貌、低聲\n---結束角色---'}
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, padding: '0.65rem', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
          <button onClick={handleImport}
            style={{ marginTop: 8, padding: '0.55rem 0.75rem', background: 'transparent', border: `1px solid ${T.border2}`, borderRadius: 6, color: T.accent, fontSize: 11, cursor: 'pointer' }}>
            解析並套用
          </button>
          {importStatus && <span style={{ marginLeft: 8, fontSize: 10, color: T.text3 }}>{importStatus}</span>}
          {importedNames.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {importedNames.map(name => (
                <span key={name} style={{ fontSize: 10, color: T.text2, border: `1px solid ${T.border}`, borderRadius: 99, padding: '2px 7px' }}>{name}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 8 }}>主導引擎</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
            {ENGINE_OPTIONS.map(opt => {
              const active = engine === opt.id
              return (
                <button key={opt.id} onClick={() => setEngine(opt.id)}
                  style={{
                    textAlign: 'left',
                    background: active ? `${T.accent}18` : T.bg3,
                    border: `1px solid ${active ? T.accent : T.border}`,
                    borderRadius: 6,
                    padding: '0.65rem',
                    cursor: 'pointer',
                    color: active ? T.accent : T.text2,
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{opt.label}</div>
                  <div style={{ fontSize: 9, lineHeight: 1.5, color: active ? T.text2 : T.text3 }}>{opt.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Scene */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 8 }}>場景設定</div>
          <textarea
            value={scene} rows={3}
            onChange={e => setScene(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 13, padding: '0.3rem 0', outline: 'none', resize: 'none', lineHeight: 1.6 }}
          />
        </div>

        <WorldCard world={world} onChange={setWorldField} />

        {/* Chars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {charIds.map(id => (
            <CharCard key={id} id={id} data={chars[id]} emotions={em[id]}
              onChange={(k, v) => setChar(id, k, v)}
              onEmotion={(k, v) => setE(id, k, v)}
              onRemove={() => removeChar(id)}
              canRemove={charIds.length > 1}
            />
          ))}
        </div>
        <button onClick={addChar}
          style={{ padding: '0.65rem', background: 'transparent', border: `1px dashed ${T.border2}`, borderRadius: 8, color: T.text2, fontSize: 12, cursor: 'pointer' }}>
          新增角色
        </button>

        <button onClick={handleStart}
          style={{ padding: '0.85rem', background: T.accent, border: 'none', borderRadius: 8, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', color: '#0a0a0f' }}>
          開幕 — 讓角色活起來
        </button>
      </div>
    </div>
  )
}
