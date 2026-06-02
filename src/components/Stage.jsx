import { useState, useEffect, useRef, useCallback } from 'react'
import { CHAR_IDS, CHAR_COLORS, DIRECTOR_CMDS, TIMER_MAX, T } from '../constants.js'
import { callClaude } from '../api.js'

function EmBar({ label, v, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: T.text3, width: 18 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${v * 10}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .6s' }} />
      </div>
      <span style={{ fontSize: 10, color: T.text2, width: 14, textAlign: 'right' }}>{v}</span>
    </div>
  )
}

function Message({ m }) {
  const isSystem = m.type === 'system'
  const isDir = m.type === 'director'
  const col = m.id ? CHAR_COLORS[m.id] : isDir ? T.accent : T.text3
  return (
    <div style={{ animation: 'fadeUp .35s ease forwards', opacity: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: col, letterSpacing: '0.04em' }}>
          {isSystem ? '// SYSTEM' : isDir ? '[ 導演 ]' : m.name}
        </span>
        {m.emotion && (
          <span style={{ fontSize: 9, color: T.text3, padding: '1px 5px', border: `1px solid ${T.border}`, borderRadius: 99 }}>
            {m.emotion}
          </span>
        )}
        {m.time && <span style={{ fontSize: 9, color: T.text3, marginLeft: 'auto' }}>{m.time}</span>}
      </div>
      <div style={{
        fontSize: isSystem ? 11 : isDir ? 12 : 13.5,
        lineHeight: 1.75,
        color: isSystem ? T.text3 : isDir ? T.accent : T.text,
        fontStyle: isDir ? 'italic' : 'normal',
        fontFamily: (!isSystem && !isDir) ? 'Georgia, serif' : 'inherit',
      }}>
        {isDir ? `→ ${m.text}` : m.text}
      </div>
    </div>
  )
}

export default function Stage({ scene, chars, initEmotions, onReset, onReport }) {
  const [msgs, setMsgs] = useState([{ type: 'system', text: '演出開始，角色進入場景……' }])
  const [emotions, setEmotions] = useState(initEmotions)
  const [round, setRound] = useState(0)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [timer, setTimer] = useState(TIMER_MAX)
  const [debug, setDebug] = useState([])
  const [showDebug, setShowDebug] = useState(false)
  const [customCmd, setCustomCmd] = useState('')

  const histRef = useRef([])
  const emotionsRef = useRef(initEmotions)
  const pausedRef = useRef(false)
  const busyRef = useRef(false)
  const feedRef = useRef(null)
  const queuedIntervention = useRef(null)

  emotionsRef.current = emotions
  pausedRef.current = paused
  busyRef.current = busy

  const now = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const log = (msg) => setDebug(p => [...p.slice(-40), `${now()} ${msg}`])
  const scroll = () => setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight }, 60)
  const addMsg = useCallback((m) => { setMsgs(p => [...p, { ...m, time: now() }]); scroll() }, [])

  const buildSystem = useCallback(() => {
    const e = emotionsRef.current
    return `你是多角色戲劇沙盒引擎，讓三個角色在場景中自然對話衝突。

場景：${scene}
角色A(${chars.a.name})：性格「${chars.a.trait}」目的「${chars.a.goal||''}」關係「${chars.a.relation||''}」秘密「${chars.a.secret}」語氣「${chars.a.tone}」
角色B(${chars.b.name})：性格「${chars.b.trait}」目的「${chars.b.goal||''}」關係「${chars.b.relation||''}」秘密「${chars.b.secret}」語氣「${chars.b.tone}」
角色C(${chars.c.name})：性格「${chars.c.trait}」目的「${chars.c.goal||''}」關係「${chars.c.relation||''}」秘密「${chars.c.secret}」語氣「${chars.c.tone}」
當前情緒(0-10)：${chars.a.name}怒${e.a.anger}懼${e.a.fear}信${e.a.trust} ${chars.b.name}怒${e.b.anger}懼${e.b.fear}信${e.b.trust} ${chars.c.name}怒${e.c.anger}懼${e.c.fear}信${e.c.trust}

嚴格只輸出以下JSON，不含任何其他文字：
{"lines":[{"char":"a","line":"台詞","emotion":"情緒標籤"},{"char":"b","line":"台詞","emotion":"情緒標籤"},{"char":"c","line":"台詞","emotion":"情緒標籤"}],"emotions":{"a":{"anger":0,"fear":0,"trust":0},"b":{"anger":0,"fear":0,"trust":0},"c":{"anger":0,"fear":0,"trust":0}}}

規則：台詞符合性格語氣、有衝突張力、1~3句、秘密不輕易揭露、情緒值±1~2。只輸出JSON。`
  }, [scene, chars])

  const doRound = useCallback(async (intervention) => {
    if (busyRef.current) {
      // queue director interventions instead of dropping them
      if (intervention) {
        queuedIntervention.current = intervention
        log(`queued: ${intervention.slice(0, 20)}`)
      }
      return
    }
    // pick up any queued intervention
    const effectiveIntervention = intervention || queuedIntervention.current
    queuedIntervention.current = null
    setBusy(true)
    busyRef.current = true
    log(`Round start${effectiveIntervention ? ` [介入: ${effectiveIntervention.slice(0, 20)}]` : ''}`)

    const hist = histRef.current
    const messages = []
    hist.forEach(h => {
      messages.push({ role: 'user', content: h.q })
      messages.push({ role: 'assistant', content: h.a })
    })

    const userMsg = effectiveIntervention
      ? `【導演介入】${effectiveIntervention}\n根據此事件讓三角色反應，只輸出JSON。`
      : '繼續推進對話，只輸出JSON。'
    messages.push({ role: 'user', content: userMsg })

    try {
      const { parsed, raw } = await callClaude(messages, buildSystem())
      log(`OK: ${raw.slice(0, 80)}`)

      hist.push({ q: userMsg, a: raw })
      if (hist.length > 8) histRef.current = hist.slice(-8)

      setRound(r => r + 1)

      if (Array.isArray(parsed.lines)) {
        parsed.lines.forEach(l => {
          if (!l.char || !l.line) return
          addMsg({ type: 'char', id: l.char, name: chars[l.char]?.name || l.char, text: l.line, emotion: l.emotion })
        })
      } else {
        log('WARNING: no lines array in response')
      }

      if (parsed.emotions) {
        const next = {}
        CHAR_IDS.forEach(id => {
          if (!parsed.emotions[id]) { next[id] = emotionsRef.current[id]; return }
          next[id] = {
            anger: Math.max(0, Math.min(10, Number(parsed.emotions[id].anger) || 0)),
            fear: Math.max(0, Math.min(10, Number(parsed.emotions[id].fear) || 0)),
            trust: Math.max(0, Math.min(10, Number(parsed.emotions[id].trust) || 0)),
          }
        })
        setEmotions(next)
      }
    } catch (e) {
      log(`ERROR: ${e.message}`)
      addMsg({ type: 'system', text: `⚠ 第${round + 1}輪失敗：${e.message.slice(0, 100)}` })
    }

    setBusy(false)
    busyRef.current = false
    setTimer(TIMER_MAX)
  }, [buildSystem, chars, addMsg, round])

  useEffect(() => { doRound(null) }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current || busyRef.current) return
      setTimer(t => {
        if (t <= 1) { doRound(null); return TIMER_MAX }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [doRound])

  const intervene = (cmd) => {
    addMsg({ type: 'director', text: cmd })
    setTimer(TIMER_MAX)
    doRound(cmd)
  }

  const handleCustom = () => {
    if (!customCmd.trim()) return
    intervene(customCmd.trim())
    setCustomCmd('')
  }

  return (
    <div style={{ height: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', fontFamily: "'DM Mono', monospace" }}>
      {/* topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, background: T.red, borderRadius: '50%', animation: 'blink 1.2s ease-in-out infinite' }} />
          <span style={{ fontSize: 10, color: T.text2, letterSpacing: '0.1em' }}>LIVE</span>
          <span style={{ fontSize: 10, color: T.text3, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scene}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => setShowDebug(p => !p)} style={{ fontSize: 9, padding: '0.25rem 0.5rem', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, color: T.text3, cursor: 'pointer' }}>
            {showDebug ? 'HIDE DEBUG' : 'DEBUG'}
          </button>
          <button onClick={onReset} style={{ fontSize: 10, padding: '0.3rem 0.6rem', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, color: T.text2, cursor: 'pointer' }}>重設</button>
          <button onClick={() => setPaused(p => !p)} style={{ fontSize: 10, padding: '0.3rem 0.6rem', background: 'transparent', border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text2, cursor: 'pointer' }}>
            {paused ? '繼續' : '暫停'}
          </button>
          <button onClick={() => onReport(chars, emotions, histRef.current, scene)}
            style={{ fontSize: 10, padding: '0.3rem 0.7rem', background: T.accent, border: `1px solid ${T.accent}`, borderRadius: 4, color: '#0a0a0f', fontWeight: 700, cursor: 'pointer' }}>
            生成建議書
          </button>
        </div>
      </div>

      {/* debug */}
      {showDebug && (
        <div style={{ background: '#060608', borderBottom: `1px solid ${T.border}`, padding: '0.5rem 1rem', maxHeight: 120, overflowY: 'auto', flexShrink: 0 }}>
          {debug.length === 0 && <div style={{ fontSize: 10, color: T.text3 }}>無記錄</div>}
          {debug.map((d, i) => <div key={i} style={{ fontSize: 10, color: '#6a6', fontFamily: 'monospace', lineHeight: 1.4 }}>{d}</div>)}
        </div>
      )}

      {/* body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px', minHeight: 0 }}>
        {/* feed */}
        <div ref={feedRef} style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', borderRight: `1px solid ${T.border}` }}>
          {msgs.map((m, i) => <Message key={i} m={m} />)}
          {busy && (
            <div style={{ display: 'flex', gap: 4, padding: '0.4rem 0' }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <div key={i} style={{ width: 5, height: 5, background: T.text3, borderRadius: '50%', animation: `pulse 1s ${d}s ease-in-out infinite` }} />
              ))}
            </div>
          )}
        </div>

        {/* right panel */}
        <div style={{ overflowY: 'auto', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* timer */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.text3, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>下一輪</div>
            <div style={{ textAlign: 'center', background: T.bg3, borderRadius: 6, border: `1px solid ${T.border}`, padding: '0.65rem' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '1.8rem', color: T.accent, lineHeight: 1 }}>{String(timer).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: T.text3, marginTop: 2 }}>{busy ? '生成中…' : paused ? '已暫停' : '秒後自動推進'}</div>
              <div style={{ height: 2, background: 'rgba(255,255,255,.08)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(timer / TIMER_MAX) * 100}%`, height: '100%', background: T.accent, transition: 'width 1s linear' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.text3, marginTop: 4 }}>
              <span>第 {round} 輪</span>
              <span style={{ color: paused ? T.text3 : T.teal }}>{paused ? '暫停中' : '演出中'}</span>
            </div>
          </div>

          {/* emotions */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.text3, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>情緒儀表板</div>
            {CHAR_IDS.map(id => (
              <div key={id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: 'rgba(255,255,255,.05) 1px solid' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: CHAR_COLORS[id], marginBottom: 4 }}>{chars[id].name}</div>
                <EmBar label="怒" v={emotions[id].anger} color={T.red} />
                <EmBar label="懼" v={emotions[id].fear}  color={T.amber} />
                <EmBar label="信" v={emotions[id].trust} color={T.teal} />
              </div>
            ))}
          </div>

          {/* director commands */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.text3, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>導演介入</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
              {DIRECTOR_CMDS.map((cmd, i) => {
                const short = cmd.replace(/，.*/, '')
                return (
                  <button key={i} onClick={() => intervene(cmd)}
                    style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 5, padding: '0.4rem', fontSize: 9, color: T.text2, cursor: 'pointer', lineHeight: 1.3, transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text2 }}>
                    {short}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={customCmd} onChange={e => setCustomCmd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustom()}
                placeholder="自訂干涉指令…"
                style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 5, padding: '0.35rem 0.5rem', color: T.text, fontSize: 10, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={handleCustom}
                style={{ background: 'transparent', border: `1px solid ${T.border2}`, borderRadius: 5, padding: '0.35rem 0.5rem', color: T.accent, fontSize: 10, cursor: 'pointer' }}>
                發
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
