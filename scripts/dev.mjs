// Local dev server: builds the static app and serves dist/ plus the /api handlers, so the whole tool
// (including demo mode) runs with `npm run dev` and no Vercel CLI.
//   KATO8_DEMO=1 npm run dev
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const port = Number(process.env.PORT || 5173)
const root = path.resolve('dist')
const built = spawnSync(process.execPath, ['build.js'], { stdio: 'inherit', env: process.env })
if (built.status !== 0) process.exit(built.status ?? 1)

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  res.status = code => { res.statusCode = code; return res }
  res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res }

  const api = /^\/api\/([a-z0-9-]+)\/?$/.exec(url.pathname)
  if (api) {
    try {
      const chunks = []
      for await (const c of req) chunks.push(c)
      try { req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { req.body = {} }
      const file = path.resolve('api', `${api[1]}.js`)
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' })
      const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
      return await mod.default(req, res)
    } catch (err) {
      console.error('[api]', err?.message)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
      return
    }
  }

  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  const file = path.resolve(root, rel)
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found') }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
}).listen(port, () => console.log(`Director's Cut on http://localhost:${port}`))
