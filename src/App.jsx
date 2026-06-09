import { useState } from 'react'
import Setup from './components/Setup.jsx'
import Stage from './components/Stage.jsx'
import Report from './components/Report.jsx'

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes pulse  { 0%,100%{opacity:.2} 50%{opacity:1} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body,#root { height:100%; }
  body { background:#0a0a0f; color:#e8e6e0; font-family:'DM Mono',monospace,sans-serif; }
  input,textarea,button { font-family:'DM Mono',monospace,sans-serif; }
  input::placeholder,textarea::placeholder { color:#44423e; }
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:2px; }
`

export default function App() {
  const [screen, setScreen] = useState('setup')
  const [stageProps, setStageProps] = useState(null)
  const [stageKey, setStageKey] = useState(0)
  const [reportProps, setReportProps] = useState(null)

  return (
    <>
      <style>{globalCss}</style>

      {screen === 'setup' && (
        <Setup onStart={async (scene, chars, emotions, engine, world) => {
          const sessionId = crypto.randomUUID()
          await fetch('/api/bridge/pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, reset: true }),
          }).catch(() => {})
          setStageProps({ scene, chars, initEmotions: emotions, engine, world, sessionId })
          setStageKey(k => k + 1)
          setScreen('stage')
        }} />
      )}

      {screen === 'stage' && stageProps && (
        <Stage
          key={stageKey}
          {...stageProps}
          onReset={() => setScreen('setup')}
          onReport={(chars, emotions, history, scene, engine, world) => {
            setReportProps({ chars, emotions, history, scene, engine, world })
            setScreen('report')
          }}
        />
      )}

      {screen === 'report' && reportProps && (
        <Report
          {...reportProps}
          onBack={() => setScreen('stage')}
        />
      )}
    </>
  )
}
