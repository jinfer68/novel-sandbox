import { useState, useEffect } from 'react'
import { T } from '../constants.js'
import { callClaude } from '../api.js'

function worldList(world, key) {
  const value = world?.[key]
  return Array.isArray(value) ? value.join('；') : value || ''
}

function buildWorldText(world) {
  if (!world) return ''
  return `世界觀：${world.premise || ''}
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

export default function Report({ chars, emotions, history, scene, engine = 'claude-code', world, sessionId, onBack }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [comicPromptText, setComicPromptText] = useState('')
  const [copyHint, setCopyHint] = useState('')

  useEffect(() => {
    const charIds = Object.keys(chars)
    const histText = history.slice(-8).map((h, i) => `輪${i + 1}:${h.a.slice(0, 200)}`).join(' | ')
    const emSnap = charIds.map(id => {
      const e = emotions[id] || { anger: 0, fear: 0, trust: 0 }
      return `${chars[id].name}怒${e.anger}懼${e.fear}信${e.trust}`
    }).join(' ')

    const prompt = `你是資深編劇顧問。分析以下即興戲劇，只輸出JSON，不含任何其他文字：

場景：${scene}
${buildWorldText(world)}
${charIds.map(id => `角色${id.toUpperCase()}(${chars[id].name})秘密：${chars[id].secret} 補充設定：${chars[id].notes || ''}`).join(' ')}
對話記錄：${histText}
最終情緒：${emSnap}

輸出格式（只輸出JSON）：
{"summary":"3~5句概括張力","prose":"將演繹轉成一段小說正文草稿","arcs":[{"char":"名字","arc":"弧線一句話"}],"usable_lines":["可直接放進小說的台詞"],"paths":[{"label":"路線一標題","desc":"30字內轉折"},{"label":"路線二標題","desc":"30字"},{"label":"路線三標題","desc":"30字"}],"tension":"最高張力點一句話","comics":[{"title":"漫畫畫格標題","shot":"鏡頭與構圖，30字內","caption":"旁白框文字，30字內","dialogue":"畫格內最有力的一句對白","palette":"色調與光影","prompt":"可交給圖像模型的完整漫畫圖像提示"}]}

comics 必須剛好三張，根據本場劇情生成連續漫畫畫格，不要重複三條岔路。`

    callClaude([{ role: 'user', content: prompt }], '', { engine, sessionId })
      .then(({ parsed }) => {
        setData(parsed)
        setComicPromptText('')
        setCopyHint('')
      })
      .catch(e => setErr(e.message))
  }, [])

  const copy = () => {
    if (!data) return
    const plotPoints = data.story?.plot_points?.map((pt, i) => `${i + 1}. ${pt}`).join('\n') || data.summary || ''
    const draft = data.story?.draft || data.prose || ''
    const lines = data.usable_lines?.map(item =>
      typeof item === 'object' ? `${item.line}\n   ——${item.speaker}，${item.tone}` : item
    ).join('\n') || ''
    const comics = getComics(data).map((c, i) =>
      `${i + 1}. ${c.title || `漫畫畫格 ${i + 1}`}\n畫面：${c.shot || ''}\n旁白：${c.caption || ''}\n對白：${c.dialogue || ''}\n色調：${c.palette || ''}\n圖像提示：${c.prompt || ''}`
    ).join('\n\n')
    const t = `【情節推進建議書】\n\n▌本場情節\n${plotPoints}\n\n▌小說草稿\n${draft}\n\n▌角色弧線\n${data.arcs?.map(a => `${a.char}：${a.arc}`).join('\n')}\n\n▌最高張力\n${data.tension}\n\n▌可用台詞\n${lines}\n\n▌三條岔路\n${data.paths?.map(p => `${p.label}\n${p.desc}`).join('\n\n')}\n\n▌三張劇情漫畫\n${comics}`
    navigator.clipboard.writeText(t).then(() => alert('已複製！'))
  }

  const getComics = value => {
    const raw = value?.comics || value?.comic_panels || value?.comicPanels || []
    return Array.isArray(raw) ? raw.slice(0, 3) : []
  }

  const getComicPanels = value => {
    const comics = getComics(value)
    if (comics.length > 0) return comics

    const paths = Array.isArray(value?.paths) ? value.paths : []
    const draft = value?.story?.draft || value?.prose || value?.summary || ''
    const tension = value?.tension || '角色之間的秘密即將破裂'
    return [0, 1, 2].map(i => {
      const path = paths[i] || {}
      const title = path.label || `劇情畫格 ${i + 1}`
      const shot = path.desc || (i === 0 ? tension : draft.slice(i * 36, i * 36 + 60)) || '角色在關鍵場景中對峙，秘密與壓力同時浮現。'
      const caption = i === 0 ? '這一刻，所有人的謊言都開始失去形狀。' : i === 1 ? '沒有人能確定真相先背叛了誰。' : '下一步，故事會選擇最痛的方向。'
      const dialogue = Array.isArray(value?.usable_lines) && value.usable_lines[i]
        ? (typeof value.usable_lines[i] === 'object' ? value.usable_lines[i].line : value.usable_lines[i])
        : '「現在，說實話。」'
      return {
        title,
        shot,
        caption,
        dialogue,
        palette: i === 0 ? '冷藍陰影、金色邊光、黑色墨線' : i === 1 ? '暗紅焦點、灰黑背景、高反差陰影' : '低飽和褐色、白色反光、緊張構圖',
        prompt: `劇情漫畫單格，${title}。畫面：${shot}。旁白框：${caption}。對白：${dialogue}。風格：懸疑推理漫畫，高反差墨線，電影感分鏡，${i === 0 ? '冷藍陰影、金色邊光' : i === 1 ? '暗紅焦點、灰黑背景' : '低飽和褐色、尖銳白色反光'}。`,
      }
    })
  }

  const writeClipboard = async text => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!ok) throw new Error('copy command failed')
    return true
  }

  const copyComicPrompts = async () => {
    const panels = getComicPanels(data)
    const prompts = panels.map((panel, i) => {
      const fallback = `${panel.title || `漫畫畫格 ${i + 1}`}。畫面：${panel.shot || ''}。旁白：${panel.caption || ''}。對白：${panel.dialogue || ''}。色調：${panel.palette || ''}。`
      return `【第 ${i + 1} 張】\n${panel.prompt || fallback}`
    })

    const text = `請在本地聊天中幫我生成三張劇情漫畫：\n\n${prompts.join('\n\n')}`
    setComicPromptText(text)
    try {
      await writeClipboard(text)
      setCopyHint('已複製。也可以直接從下方文字框選取。')
    } catch {
      setCopyHint('瀏覽器阻擋自動複製，請從下方文字框手動選取複製。')
    }
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
            {/* ── 本場發生了什麼（情節清單 + 草稿合併） ── */}
            <Sec title="本場情節">
              {/* 情節清單 */}
              {(data.story?.plot_points || []).map((pt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '0.3rem 0', borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                  <span style={{ color: T.accent, fontFamily: 'monospace', fontSize: 10, minWidth: 18, marginTop: 2 }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.75, fontFamily: 'Georgia, serif' }}>{pt}</span>
                </div>
              ))}
              {/* 相容舊版 summary */}
              {!data.story && data.summary && (
                <p style={{ fontSize: 13, lineHeight: 1.85, color: T.text, fontFamily: 'Georgia, serif', margin: 0 }}>{data.summary}</p>
              )}
              {/* 小說草稿段落 */}
              {(data.story?.draft || data.prose) && (
                <p style={{ fontSize: 13, lineHeight: 1.95, color: T.text2, fontFamily: 'Georgia, serif', marginTop: '0.9rem', marginBottom: 0, paddingTop: '0.75rem', borderTop: `1px solid ${T.border}` }}>
                  {data.story?.draft || data.prose}
                </p>
              )}
            </Sec>

            <Sec title="角色情緒弧線">
              {data.arcs?.map((a, i) => (
                <div key={i} style={{ padding: '0.35rem 0', borderBottom: `1px solid ${T.border}`, fontSize: 12, color: T.text, lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
                  <span style={{ color: T.accent, fontFamily: 'monospace', fontSize: 9 }}>{a.char}</span>　{a.arc}
                </div>
              ))}
            </Sec>

            <Sec title="當前最高張力">
              <p style={{ fontSize: 13, color: T.red, fontFamily: 'Georgia, serif', lineHeight: 1.8, margin: 0 }}>{data.tension}</p>
            </Sec>

            {data.usable_lines?.length > 0 && (
              <Sec title="可用台詞">
                {data.usable_lines.map((item, i) => {
                  const isObj = item && typeof item === 'object'
                  return (
                    <div key={i} style={{ padding: '0.45rem 0', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
                        {isObj ? item.line : item}
                      </div>
                      {isObj && (
                        <div style={{ fontSize: 10.5, color: T.text3, marginTop: 3, fontFamily: 'monospace' }}>
                          {item.speaker}　／　{item.tone}
                        </div>
                      )}
                    </div>
                  )
                })}
              </Sec>
            )}

            <Sec title="三條情節岔路">
              {data.paths?.map((p, i) => (
                <div key={i} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 6, padding: '0.65rem 0.85rem', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: T.accent, marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 12.5, color: T.text, lineHeight: 1.7 }}>{p.desc}</div>
                </div>
              ))}
            </Sec>

            {data && (
              <Sec title="三張劇情漫畫">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, color: T.text3, lineHeight: 1.6 }}>
                    先生成漫畫分鏡，再把提示貼到本地聊天請 Codex 產生三張圖。
                  </div>
                  <button
                    onClick={copyComicPrompts}
                    style={{ flexShrink: 0, padding: '0.5rem 0.65rem', background: T.teal, border: 'none', borderRadius: 6, color: '#06110d', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    顯示／複製提示
                  </button>
                </div>
                {copyHint && (
                  <div style={{ fontSize: 10.5, color: copyHint.startsWith('已') ? T.teal : T.amber, marginBottom: 8, lineHeight: 1.6 }}>
                    {copyHint}
                  </div>
                )}
                {comicPromptText && (
                  <textarea
                    value={comicPromptText}
                    readOnly
                    onFocus={event => event.target.select()}
                    style={{ width: '100%', minHeight: 150, boxSizing: 'border-box', marginBottom: 12, padding: '0.75rem', background: T.bg3, border: `1px solid ${T.border2}`, borderRadius: 6, color: T.text, fontSize: 11.5, lineHeight: 1.65, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  {getComicPanels(data).map((panel, i) => (
                    <div key={i} style={{ background: '#f3ead8', color: '#1c1712', border: '2px solid #0d0d0d', borderRadius: 4, overflow: 'hidden', boxShadow: '4px 4px 0 rgba(0,0,0,.45)' }}>
                      {panel.image ? (
                        <img
                          src={panel.image}
                          alt={panel.title || `漫畫畫格 ${i + 1}`}
                          style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderBottom: '2px solid #111' }}
                        />
                      ) : (
                        <div style={{ minHeight: 150, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: `linear-gradient(135deg, #f3ead8 0%, #d8c08a 55%, ${i === 1 ? '#9db0c8' : i === 2 ? '#a86f58' : '#2b2b35'} 100%)` }}>
                          <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: '#fff7e8', border: '1.5px solid #111', padding: '0.35rem 0.45rem', fontSize: 10.5, lineHeight: 1.5, fontFamily: 'Georgia, serif' }}>
                            {panel.caption || panel.title}
                          </div>
                          <div style={{ alignSelf: 'flex-end', maxWidth: '88%', background: '#fff', border: '1.5px solid #111', borderRadius: '14px 14px 14px 2px', padding: '0.4rem 0.55rem', fontSize: 11, lineHeight: 1.45, fontWeight: 700 }}>
                            {panel.dialogue || '……'}
                          </div>
                        </div>
                      )}
                      <div style={{ padding: '0.55rem 0.65rem', borderTop: '2px solid #111' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{panel.title || `畫格 ${i + 1}`}</div>
                        <div style={{ fontSize: 11.5, lineHeight: 1.55, fontFamily: 'Georgia, serif' }}>{panel.shot}</div>
                        {panel.palette && (
                          <div style={{ fontSize: 9.5, color: '#6b5540', marginTop: 5 }}>{panel.palette}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Sec>
            )}

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
