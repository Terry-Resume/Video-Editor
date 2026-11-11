// Builds the static app into dist/. Configuration comes from the environment and is written to dist/config.js,
// so no key is committed and the same source builds for demo, preview and production.
import fs from 'node:fs'
import { CLERK_JS_URL, getTool, toolUrl, ALL_ROLES } from '@kato8/core'
import { isDemo } from '@kato8/core/server'

const demo = isDemo(process.env)
const clerkKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || ''
if (!demo && !/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(clerkKey)) {
  console.error('Build stopped: set CLERK_PUBLISHABLE_KEY (pk_test_… or pk_live_…), or KATO8_DEMO=1 for the fictional demo.\n' +
    'A build without either would ship a sign-in gate that cannot work.')
  process.exit(1)
}

const hubUrl = toolUrl('hub')
const config = {
  demo,
  clerkKey: demo ? '' : clerkKey,
  allowedRoles: getTool('video').roles,
  roles: ALL_ROLES,
  hubUrl,
}

fs.rmSync('dist', { recursive: true, force: true })
fs.mkdirSync('dist', { recursive: true })

const clerkScript = demo ? '' : `<script src="${CLERK_JS_URL}" crossorigin="anonymous"></script>`
for (const page of ['index.html', 'dashboard.html']) {
  const html = fs.readFileSync(page, 'utf8')
    .replaceAll('<!--KATO8:CLERK_SCRIPT-->', clerkScript)
    .replaceAll('%%HUB_URL%%', hubUrl)
  fs.writeFileSync(`dist/${page}`, html)
}
fs.copyFileSync('gate.js', 'dist/gate.js')
fs.writeFileSync('dist/config.js', `window.KATO8_CONFIG = ${JSON.stringify(config)};\n`)
console.log(`Build complete (${demo ? 'demo' : 'production'} mode).`)
