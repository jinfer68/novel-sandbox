import { useState } from 'react'
import { CHAR_IDS, CHAR_COLORS, DEFAULT_CHARS, DEFAULT_SCENE, DEFAULT_EMOTIONS, T } from '../constants.js'
import { hasApiKey, saveApiKey } from '../api.js'

function CharCard({ id, data, emotions, onChange, onEmotion }) {
  const col = CHAR_COLORS[id]
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderTop: `2px solid ${col}`, borderRadius: 8, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${col}22`, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
          {(data.name || '?')[0]}
        </div>
        <input
          value={data.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder={DEFAULT_CHARS[id].name}
          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: col, fontSize: 13, fontWeight: 600, padding: '0.2rem 0', outline: 'none' }}
        />
      </div>

      {[['性格', 'trait'], ['目的', 'goal'], ['與他人的關係', 'relation'], ['秘密', 'secret'], ['語氣', 'tone']].map(([lbl, k]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>{lbl}</div>
          <input
            value={data[k]}
            onChange={e => onChange(k, e.target.value)}
            placeholder={DEFAULT_CHARS[id][k]}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 12, padding: '0.2rem 0', outline: 'none' }}
          />
        </div>
      ))}

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
    </div>
  )
}

export default function Setup({ onStart }) {
  const [scene, setScene] = useState(DEFAULT_SCENE)
  const [chars, setChars] = useState({ a: { ...DEFAULT_CHARS.a }, b: { ...DEFAULT_CHARS.b }, c: { ...DEFAULT_CHARS.c } })
  const [em, setEm] = useState({ a: { ...DEFAULT_EMOTIONS.a }, b: { ...DEFAULT_EMOTIONS.b }, c: { ...DEFAULT_EMOTIONS.c } })
  const [apiKey, setApiKey] = useState('')
  const [keyError, setKeyError] = useState('')

  const setChar = (id, k, v) => setChars(p => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const setE = (id, k, v) => setEm(p => ({ ...p, [id]: { ...p[id], [k]: v } }))

  const handleStart = () => {
    if (!hasApiKey()) {
      if (!apiKey.trim().startsWith('sk-ant-')) {
        setKeyError('請輸入有效的 Anthropic API Key（格式：sk-ant-...）')
        return
      }
      saveApiKey(apiKey.trim())
    }
    setKeyError('')
    onStart(scene || DEFAULT_SCENE, chars, em)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: T.accent, marginBottom: 4 }}>NOVEL SANDBOX MVP</div>
        <div style={{ fontSize: 'clamp(1.8rem,5vw,3rem)', fontWeight: 700, color: T.text, letterSpacing: '0.05em', lineHeight: 1 }}>靈感培養皿</div>
        <div style={{ fontSize: 11, color: T.text2, marginTop: 6 }}>設定世界觀與角色，然後放手觀看</div>
      </div>

      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* API Key */}
        {!hasApiKey() && (
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 8 }}>Anthropic API Key</div>
            <input
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setKeyError('') }}
              placeholder="sk-ant-api03-..."
              type="password"
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 13, padding: '0.3rem 0', outline: 'none' }}
            />
            {keyError && <div style={{ color: T.red, fontSize: 10, marginTop: 6 }}>{keyError}</div>}
            <div style={{ fontSize: 9, color: T.text3, marginTop: 6 }}>Key 僅存在 localStorage，不會上傳任何地方。或在專案根目錄建立 .env 並設定 VITE_ANTHROPIC_API_KEY=sk-ant-...</div>
          </div>
        )}

        {/* Scene */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 8 }}>場景設定</div>
          <textarea
            value={scene} rows={3}
            onChange={e => setScene(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.text, fontSize: 13, padding: '0.3rem 0', outline: 'none', resize: 'none', lineHeight: 1.6 }}
          />
        </div>

        {/* Chars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {CHAR_IDS.map(id => (
            <CharCard key={id} id={id} data={chars[id]} emotions={em[id]}
              onChange={(k, v) => setChar(id, k, v)}
              onEmotion={(k, v) => setE(id, k, v)}
            />
          ))}
        </div>

        <button onClick={handleStart}
          style={{ padding: '0.85rem', background: T.accent, border: 'none', borderRadius: 8, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', color: '#0a0a0f' }}>
          開幕 — 讓角色活起來
        </button>
      </div>
    </div>
  )
}
