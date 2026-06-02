import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const PENDING_FILE = '/tmp/novel-sandbox-pending.json'
const QUEUE_FILE = '/tmp/novel-sandbox-queue.json'

// reset files on startup
fs.writeFileSync(PENDING_FILE, '{}')
fs.writeFileSync(QUEUE_FILE, '[]')

function bridgePlugin() {
  return {
    name: 'novel-sandbox-bridge',
    configureServer(server) {
      // browser → signals it's waiting with intervention text
      server.middlewares.use('/api/bridge/pending', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'POST') {
          let body = ''
          req.on('data', d => body += d)
          req.on('end', () => {
            fs.writeFileSync(PENDING_FILE, body)
            res.end('ok')
          })
        } else {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(PENDING_FILE, 'utf8'))
        }
      })

      // Claude Code → pushes generated dialogue
      server.middlewares.use('/api/bridge/push', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'POST') {
          let body = ''
          req.on('data', d => body += d)
          req.on('end', () => {
            fs.writeFileSync(QUEUE_FILE, body)
            fs.writeFileSync(PENDING_FILE, '{}')
            res.end('ok')
          })
        } else {
          res.writeHead(405); res.end()
        }
      })

      // browser → polls for generated content
      server.middlewares.use('/api/bridge/queue', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        try {
          const data = fs.readFileSync(QUEUE_FILE, 'utf8')
          const payload = JSON.parse(data)
          if (payload && (payload.lines || payload.summary)) {
            fs.writeFileSync(QUEUE_FILE, '[]')
            res.end(data)
          } else {
            res.writeHead(204); res.end()
          }
        } catch {
          res.writeHead(204); res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), bridgePlugin()],
  server: {
    port: 3000,
  },
})
