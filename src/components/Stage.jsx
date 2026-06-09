import { useState, useEffect, useRef, useCallback } from 'react'
import { CHAR_COLORS, pickDirectorCmds, ENGINE_TIMER_MAX, TIMER_MAX, T } from '../constants.js'
import { callClaude, resetLocalEngine } from '../api.js'

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
  const isNarrator = m.type === 'narrator'
  const col = m.id ? (CHAR_COLORS[m.id] || T.accent) : isDir ? T.accent : isNarrator ? T.amber : T.text3
  return (
    <div style={{ animation: 'fadeUp .35s ease forwards', opacity: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: col, letterSpacing: '0.04em' }}>
          {isSystem ? '// SYSTEM' : isDir ? '[ 導演 ]' : isNarrator ? '[ 旁白 ]' : m.name}
        </span>
        {m.emotion && (
          <span style={{ fontSize: 9, color: T.text3, padding: '1px 5px', border: `1px solid ${T.border}`, borderRadius: 99 }}>
            {m.emotion}
          </span>
        )}
        {m.time && <span style={{ fontSize: 9, color: T.text3, marginLeft: 'auto' }}>{m.time}</span>}
      </div>
      <div style={{
        fontSize: isSystem ? 11 : isDir || isNarrator ? 12 : 13.5,
        lineHeight: 1.75,
        color: isSystem ? T.text3 : isDir ? T.accent : isNarrator ? T.text2 : T.text,
        fontStyle: isDir || isNarrator ? 'italic' : 'normal',
        fontFamily: (!isSystem && !isDir) ? 'Georgia, serif' : 'inherit',
      }}>
        {isDir ? `→ ${m.text}` : m.text}
      </div>
    </div>
  )
}

function worldList(world, key) {
  const value = world?.[key]
  return Array.isArray(value) ? value.join('；') : value || ''
}

function buildWorldText(world) {
  if (!world) return ''
  return `世界觀：
核心前提：${world.premise || ''}
類型：${world.genre || ''}
地點：${world.location || ''}
時代：${world.era || ''}
氣氛：${world.atmosphere || ''}
規則：${worldList(world, 'rules')}
勢力：${worldList(world, 'factions')}
核心衝突：${worldList(world, 'conflicts')}
世界秘密：${worldList(world, 'secrets')}
時間線：${worldList(world, 'timeline')}
導演備註：${world.director_notes || ''}`
}

function engineLabel(engine) {
  if (engine === 'codex') return 'Codex'
  if (engine === 'claude-code') return 'Claude Code'
  return 'Local'
}

export default function Stage({ scene, chars, initEmotions, engine = 'claude-code', world, sessionId, onReset, onReport }) {
  const timerMax = ENGINE_TIMER_MAX[engine] || TIMER_MAX
  const activeEngineLabel = engineLabel(engine)
  const charIds = Object.keys(chars)
  const [msgs, setMsgs] = useState([{ type: 'system', text: '演出開始，角色進入場景……' }])
  const [emotions, setEmotions] = useState(initEmotions)
  const [round, setRound] = useState(0)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [timer, setTimer] = useState(timerMax)
  const [debug, setDebug] = useState([])
  const [showDebug, setShowDebug] = useState(false)
  const [customCmd, setCustomCmd] = useState('')
  const [dirCmds, setDirCmds] = useState(() => pickDirectorCmds(4))
  const [queuedCmd, setQueuedCmd] = useState('')

  const histRef = useRef([])
  const emotionsRef = useRef(initEmotions)
  const pausedRef = useRef(false)
  const busyRef = useRef(false)
  const feedRef = useRef(null)
  const queuedIntervention = useRef(null)
  const runSeqRef = useRef(0)
  const activeRunSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const doRoundRef = useRef(null)

  emotionsRef.current = emotions
  pausedRef.current = paused
  busyRef.current = busy

  const now = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const log = (msg) => setDebug(p => [...p.slice(-40), `${now()} ${msg}`])
  const scroll = () => setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight }, 60)
  const addMsg = useCallback((m) => { setMsgs(p => [...p, { ...m, time: now() }]); scroll() }, [])

  const buildSystem = useCallback(() => {
    const characterText = charIds.map((id, index) => {
      const c = chars[id]
      const e = emotionsRef.current[id] || { anger: 3, fear: 3, trust: 4 }
      return `角色${index + 1}/${id}(${c.name})：性格「${c.trait}」目的「${c.goal || ''}」關係「${c.relation || ''}」秘密「${c.secret}」語氣「${c.tone}」補充設定「${c.notes || ''}」；情緒怒${e.anger}懼${e.fear}信${e.trust}`
    }).join('\n')

    return `你是多角色戲劇沙盒引擎，讓角色在場景中自然對話衝突。

場景：${scene}
${buildWorldText(world)}
${characterText}

嚴格只輸出以下JSON，不含任何其他文字：
{"narration":"旁白敘事，可空字串","lines":[{"char":"${charIds[0] || 'a'}","line":"台詞","emotion":"情緒標籤"}],"decisions":[{"char":"角色名","intent":"本輪行動意圖","because":"依據設定或事件的可讀理由"}],"director_effect":"導演指令如何影響本輪，可空字串","emotions":{${charIds.map(id => `"${id}":{"anger":0,"fear":0,"trust":0}`).join(',')}}}

規則：每輪可讓1到${charIds.length}名最適合的角色發言；所有角色都可被選中，若導演介入點名某角色，該角色必須有反應；台詞符合性格語氣、有衝突張力、1~3句、秘密不輕易揭露、情緒值±1~2。只輸出JSON。`
  }, [scene, chars, charIds, world])

  const doRound = useCallback(async (intervention) => {
    if (busyRef.current) {
      // queue director interventions instead of dropping them
      if (intervention) {
        queuedIntervention.current = intervention
        setQueuedCmd(intervention)
        log(`queued: ${intervention.slice(0, 20)}`)
      }
      return
    }
    // pick up any queued intervention
    const effectiveIntervention = intervention || queuedIntervention.current
    queuedIntervention.current = null
    setQueuedCmd('')
    setBusy(true)
    busyRef.current = true
    const runSeq = runSeqRef.current + 1
    runSeqRef.current = runSeq
    activeRunSeqRef.current = runSeq
    log(`Round start${effectiveIntervention ? ` [介入: ${effectiveIntervention.slice(0, 20)}]` : ''}`)

    const hist = histRef.current
    const messages = []
    hist.forEach(h => {
      messages.push({ role: 'user', content: h.q })
      messages.push({ role: 'assistant', content: h.a })
    })

    const userMsg = effectiveIntervention
      ? `【導演介入】${effectiveIntervention}\n根據此事件讓所有相關角色反應；若指令點名某角色，該角色必須有台詞或旁白反應。只輸出JSON。`
      : '繼續推進對話，只輸出JSON。'
    messages.push({ role: 'user', content: userMsg })

    try {
      const { parsed, raw } = await callClaude(messages, buildSystem(), {
        engine,
        sessionId,
        onRequest: id => log(`request: ${id.slice(0, 8)}`),
      })
      if (!mountedRef.current || activeRunSeqRef.current !== runSeq) {
        log(`stale response ignored: run ${runSeq}`)
        return
      }
      log(`OK: ${raw.slice(0, 80)}`)

      hist.push({ q: userMsg, a: raw })
      if (hist.length > 8) histRef.current = hist.slice(-8)

    setRound(r => r + 1)

      if (parsed.narration) {
        addMsg({ type: 'narrator', text: parsed.narration })
      }

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
      charIds.forEach(id => {
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
      if (mountedRef.current && activeRunSeqRef.current === runSeq) {
        addMsg({ type: 'system', text: `⚠ 第${round + 1}輪失敗：${e.message.slice(0, 100)}` })
      } else {
        log(`stale error ignored: run ${runSeq}`)
      }
    } finally {
      if (mountedRef.current && activeRunSeqRef.current === runSeq) {
        setBusy(false)
        busyRef.current = false
        setTimer(timerMax)

        if (queuedIntervention.current) {
          window.setTimeout(() => doRoundRef.current?.(null), 0)
        }
      } else if (!mountedRef.current || activeRunSeqRef.current === -1) {
        busyRef.current = false
      }
    }
  }, [buildSystem, chars, addMsg, round, engine, sessionId, timerMax, charIds])

  doRoundRef.current = doRound

  useEffect(() => {
    mountedRef.current = true
    if (engine === 'local') resetLocalEngine()
    doRound(null)
    return () => {
      mountedRef.current = false
      activeRunSeqRef.current = -1
      busyRef.current = false
    }
  }, [])

  useEffect(() => {
    if (paused || busy) return
    if (timer <= 0) {
      doRoundRef.current?.(null)
      return
    }

    const timeout = window.setTimeout(() => {
      setTimer(t => Math.max(0, t - 1))
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [paused, busy, timer])

  const intervene = (cmd) => {
    addMsg({ type: 'director', text: cmd })
    setTimer(timerMax)
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
          <span style={{ fontSize: 9, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 99, padding: '1px 6px' }}>{engine}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => setShowDebug(p => !p)} style={{ fontSize: 9, padding: '0.25rem 0.5rem', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, color: T.text3, cursor: 'pointer' }}>
            {showDebug ? 'HIDE DEBUG' : 'DEBUG'}
          </button>
          <button onClick={onReset} style={{ fontSize: 10, padding: '0.3rem 0.6rem', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, color: T.text2, cursor: 'pointer' }}>重設</button>
          <button onClick={() => setPaused(p => !p)} style={{ fontSize: 10, padding: '0.3rem 0.6rem', background: 'transparent', border: `1px solid ${T.border2}`, borderRadius: 4, color: T.text2, cursor: 'pointer' }}>
            {paused ? '繼續' : '暫停'}
          </button>
          <button onClick={() => onReport(chars, emotions, histRef.current, scene, engine, world)}
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
              <div style={{ fontFamily: 'monospace', fontSize: '1.8rem', color: busy ? T.text3 : T.accent, lineHeight: 1 }}>
                {busy ? '…' : String(timer).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 9, color: busy ? T.amber : T.text3, marginTop: 2, fontWeight: busy ? 600 : 400 }}>
                {busy ? `${activeEngineLabel} 生成中` : paused ? '已暫停' : timer <= 0 ? '準備下一輪' : '秒後自動推進'}
              </div>
              <div style={{ height: 2, background: 'rgba(255,255,255,.08)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
                <div style={{
                  width: busy ? '100%' : `${(timer / timerMax) * 100}%`,
                  height: '100%',
                  background: busy ? T.amber : T.accent,
                  transition: busy ? 'none' : 'width 1s linear',
                  animation: busy ? 'pulse-bar 1.5s ease-in-out infinite' : 'none',
                  opacity: busy ? undefined : 1,
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.text3, marginTop: 4 }}>
              <span>第 {round} 輪</span>
              <span style={{ color: paused ? T.text3 : T.teal }}>{paused ? '暫停中' : '演出中'}</span>
            </div>
            {queuedCmd && (
              <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: T.amber }}>
                已排入下一輪：{queuedCmd.length > 18 ? `${queuedCmd.slice(0, 18)}...` : queuedCmd}
              </div>
            )}
            <button
              onClick={() => doRound(null)}
              disabled={busy}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '0.45rem 0.55rem',
                background: busy ? T.bg3 : 'transparent',
                border: `1px solid ${busy ? T.border : T.border2}`,
                borderRadius: 5,
                color: busy ? T.text3 : T.accent,
                fontSize: 10,
                cursor: busy ? 'default' : 'pointer',
              }}>
              立即下一輪
            </button>
          </div>

          {/* emotions */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.text3, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>情緒儀表板</div>
            {charIds.map(id => (
              <div key={id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: 'rgba(255,255,255,.05) 1px solid' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: CHAR_COLORS[id] || T.accent, marginBottom: 4 }}>{chars[id].name}</div>
                <EmBar label="怒" v={emotions[id].anger} color={T.red} />
                <EmBar label="懼" v={emotions[id].fear}  color={T.amber} />
                <EmBar label="信" v={emotions[id].trust} color={T.teal} />
              </div>
            ))}
          </div>

          {/* director commands */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 9, letterSpacing: '0.2em', color: T.text3, textTransform: 'uppercase' }}>導演介入</span>
              <button
                onClick={() => setDirCmds(pickDirectorCmds(4, dirCmds))}
                title="換一批"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.text3, fontSize: 11, lineHeight: 1, padding: '0 2px', transition: 'color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = T.accent }}
                onMouseLeave={e => { e.currentTarget.style.color = T.text3 }}>
                ↻
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
              {dirCmds.map((cmd, i) => {
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
