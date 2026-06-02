import { useState, useEffect } from 'react'
import { CHAR_IDS, T } from '../constants.js'
import { callClaude } from '../api.js'

export default function Report({ chars, emotions, history, scene, onBack }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    const histText = history.slice(-8).map((h, i) => `輪${i + 1}:${h.a.slice(0, 200)}`).join(' | ')
    const emSnap = CHAR_IDS.map(id => `${chars[id].name}怒${emotions[id].anger}懼${emotions[id].fear}信${emotions[id].trust}`).join(' ')

    const prompt = `你是資深編劇顧問。分析以下即興戲劇，只輸出JSON，不含任何其他文字：

場景：${scene}
${CHAR_IDS.map(id => `角色${id.toUpperCase()}(${chars[id].name})秘密：${chars[id].secret}`).join(' ')}
對話記錄：${histText}
最終情緒：${emSnap}

輸出格式（只輸出JSON）：
{"summary":"3~5句概括張力","arcs":[{"char":"名字","arc":"弧線一句話"},{"char":"名字","arc":"弧線"},{"char":"名字","arc":"弧線"}],"paths":[{"label":"路線一標題","desc":"30字內轉折"},{"label":"路線二標題","desc":"30字"},{"label":"路線三標題","desc":"30字"}],"tension":"最高張力點一句話"}`

    callClaude([{ role: 'user', content: prompt }])
      .then(({ parsed }) => setData(parsed))
      .catch(e => setErr(e.message))
  }, [])

  const copy = () => {
    if (!data) return
    const t = `【情節推進建議書】\n\n▌摘要\n${data.summary}\n\n▌角色弧線\n${data.arcs?.map(a => `${a.char}：${a.arc}`).join('\n')}\n\n▌最高張力\n${data.tension}\n\n▌三條岔路\n${data.paths?.map(p => `${p.label}\n${p.desc}`).join('\n\n')}`
    navigator.clipboard.writeText(t).then(() => alert('已複製！'))
  }

  const Sec = ({ title, children }) => (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '0.75rem' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: T.accent, letterSpacing: '0.06em' }}>情節推進建議書</div>
        <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>AI 分析本場演出，開出三條情節岔路</div>
      </div>

      <div style={{ width: '100%', maxWidth: 600 }}>
        {!data && !err && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '3rem', color: T.text3, fontSize: 12 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${T.border2}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            分析中……
          </div>
        )}

        {err && (
          <Sec title="錯誤">
            <div style={{ color: T.red, fontSize: 12 }}>{err}</div>
          </Sec>
        )}

        {data && (
          <>
            <Sec title="劇情摘要">
              <p style={{ fontSize: 13, lineHeight: 1.85, color: T.text, fontFamily: 'Georgia, serif' }}>{data.summary}</p>
            </Sec>

            <Sec title="角色情緒弧線">
              {data.arcs?.map((a, i) => (
                <div key={i} style={{ padding: '0.35rem 0', borderBottom: `1px solid ${T.border}`, fontSize: 12, color: T.text, lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
                  <span style={{ color: T.accent, fontFamily: 'monospace', fontSize: 9 }}>{a.char}</span>　{a.arc}
                </div>
              ))}
            </Sec>

            <Sec title="當前最高張力">
              <p style={{ fontSize: 13, color: T.red, fontFamily: 'Georgia, serif', lineHeight: 1.8 }}>{data.tension}</p>
            </Sec>

            <Sec title="三條情節岔路">
              {data.paths?.map((p, i) => (
                <div key={i} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 6, padding: '0.65rem 0.85rem', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: T.accent, marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 12.5, color: T.text, lineHeight: 1.7 }}>{p.desc}</div>
                </div>
              ))}
            </Sec>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copy} style={{ flex: 1, padding: '0.7rem', background: T.accent, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#0a0a0f' }}>
                複製全文
              </button>
              <button onClick={onBack} style={{ flex: 1, padding: '0.7rem', background: 'transparent', border: `1px solid ${T.border2}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: T.text2, fontFamily: 'inherit' }}>
                ← 回到舞台
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
