import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { JSDOM, ResourceLoader } from 'jsdom'
import { CLERK_JS_URL } from '@kato8/core'
import { demoText } from '../api/_lib/demo.js'

const root = path.resolve('.')
const dist = path.join(root, 'dist')
const build = env => spawnSync(process.execPath, ['build.js'], { cwd: root, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' })
const read = f => fs.readFileSync(path.join(dist, f), 'utf8')

// Serves dist/ for http://localhost/ and answers every other URL with an empty body, so tests never touch the network.
class Loader extends ResourceLoader {
  fetch(url) {
    if (url.startsWith('http://localhost/')) {
      const f = path.join(dist, url.slice('http://localhost/'.length).split('?')[0] || 'index.html')
      return Promise.resolve(fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from(''))
    }
    return Promise.resolve(Buffer.from(''))
  }
}
const opened = []
after(() => opened.forEach(w => w.close())) // stops page timers (the dashboard polls) so the test process can exit
async function open(page, { beforeParse } = {}) {
  const dom = new JSDOM(read(page), { url: `http://localhost/${page}`, runScripts: 'dangerously', resources: new Loader(), pretendToBeVisual: true, beforeParse })
  await new Promise(r => (dom.window.document.readyState === 'complete' ? r() : dom.window.addEventListener('load', r)))
  await new Promise(r => setTimeout(r, 20))
  dom.window.alert = () => {}
  opened.push(dom.window)
  return dom
}

before(() => { assert.equal(build({ KATO8_DEMO: '1' }).status, 0) })

test('build: demo mode ships no Clerk script, no key and no browser-held API key', () => {
  const html = read('index.html') + read('dashboard.html') + read('config.js')
  assert.ok(JSON.parse(read('config.js').replace(/^window\.KATO8_CONFIG = /, '').replace(/;\s*$/, '')).demo)
  for (const bad of ['api.anthropic.com', 'x-api-key', 'dangerous-direct-browser-access', 'dc_apikey', 'pk_live_', 'unpkg.com', 'claude-sonnet-4-20250514', '%%HUB_URL%%', 'KATO8:CLERK_SCRIPT']) {
    assert.ok(!html.includes(bad), `dist must not contain ${bad}`)
  }
})

test('build: production mode pins Clerk, injects the key from the environment and refuses to build without one', () => {
  assert.equal(build({}).status, 1, 'no key and no demo flag must stop the build')
  assert.equal(build({ CLERK_PUBLISHABLE_KEY: 'not-a-key' }).status, 1)
  assert.equal(build({ CLERK_PUBLISHABLE_KEY: 'pk_test_abc123', CLERK_SECRET_KEY: 'sk_test_x', KATO8_DEMO: '1' }).status, 0)
  const cfg = JSON.parse(read('config.js').replace(/^window\.KATO8_CONFIG = /, '').replace(/;\s*$/, ''))
  assert.equal(cfg.demo, false, 'a stray demo flag must not survive a real Clerk secret')
  assert.equal(cfg.clerkKey, 'pk_test_abc123')
  for (const page of ['index.html', 'dashboard.html']) {
    assert.ok(read(page).includes(CLERK_JS_URL))
    assert.ok(!/clerk-js@\d+\//.test(read(page)), 'no floating Clerk version')
  }
  assert.deepEqual(cfg.allowedRoles.sort(), ['social_media_manager', 'super_admin'])
  assert.equal(build({ KATO8_DEMO: '1' }).status, 0)
})

test('sources hold no real Clerk key, retired model, browser-side Anthropic call or floating script', () => {
  for (const f of ['index.html', 'dashboard.html', 'gate.js', 'build.js', 'api/generate.js', 'api/_lib/generate.js', 'api/_lib/prompts.js']) {
    const t = fs.readFileSync(path.join(root, f), 'utf8')
    for (const bad of ['sk-ant-', 'claude-sonnet-4-20250514', 'api.anthropic.com', 'dc_apikey', 'unpkg.com/@clerk/clerk-js@5/']) assert.ok(!t.includes(bad), `${f} contains ${bad}`)
    assert.ok(!/pk_live_[A-Za-z0-9]{12,}/.test(t), `${f} holds a Clerk key`)
  }
})

test('gate: demo mode opens for allowed roles and closes for the rest', async () => {
  const { window } = await open('index.html')
  const { document } = window
  assert.equal(document.body.classList.contains('locked'), false)
  const sel = document.querySelector('#demo-bar select')
  sel.value = 'member'; sel.dispatchEvent(new window.Event('change'))
  assert.equal(document.body.classList.contains('locked'), true)
  assert.equal(document.getElementById('clerk-restricted').style.display, 'block')
  sel.value = 'social_media_manager'; sel.dispatchEvent(new window.Event('change'))
  assert.equal(document.body.classList.contains('locked'), false)
  assert.deepEqual(JSON.parse(JSON.stringify(await window.kato8Auth.headers())), { 'x-demo-role': 'social_media_manager' })
})

test('gate: fails CLOSED when Clerk cannot load (the old gate hid itself on any error)', async () => {
  assert.equal(build({ CLERK_PUBLISHABLE_KEY: 'pk_test_abc123' }).status, 0)
  try {
    const { window } = await open('index.html') // the Clerk script URL returns nothing, as if the CDN were down
    assert.equal(window.document.body.classList.contains('locked'), true)
    assert.equal(window.document.getElementById('clerk-unavailable').style.display, 'block')
    assert.equal(window.document.getElementById('auth-gate').style.display, 'flex')
    assert.deepEqual(JSON.parse(JSON.stringify(await window.kato8Auth.headers())), {}, 'no session, no credentials')
  } finally { assert.equal(build({ KATO8_DEMO: '1' }).status, 0) }
})

const EVIL = ['<img src=x onerror="window.__pwned=1">', '"><svg onload=window.__pwned=2>', "'); window.__pwned=3;//", '</div><script>window.__pwned=4</script>']
const evil = n => EVIL[n % EVIL.length]

test('render: hostile model output is shown as text and never becomes markup or script', async () => {
  const { window } = await open('index.html')
  const { document } = window
  window.eval(`S.selPlats=['yt','tt','ig']; S.genre='stream-gaming'; S.ctx='x'`)
  const before = { script: document.scripts.length, media: document.querySelectorAll('img,svg,iframe,object,embed').length }
  const parse = o => window.parseJSON(JSON.stringify(o))

  window.renderDirector(parse({ director_note: evil(0), score: evil(1), score_label: evil(2), estimated_duration: evil(3), recommended_duration: evil(0), cuts_count: evil(1), stream_specific_tips: evil(2), narrative_notes: evil(3), retention_notes: evil(0),
    scenes: [{ timestamp: evil(1), action: evil(2), label: 'A & B', note: evil(3), dot: evil(0) }] }))
  window.renderChapters(parse({ c: [{ timestamp: evil(1), title: evil(2), description: evil(3) }] }).c)
  window.renderClips(parse({ c: [{ timestamp: evil(0), duration: evil(1), hook: evil(2), why: evil(3), platforms: [evil(0)], viral_score: evil(1), edit_note: evil(2) }] }).c)
  const ai = { hook: evil(0), cut_style: evil(1), music_tip: evil(2), caption_style: evil(3), cta: evil(0), post_time: evil(1), edit_checklist: [evil(2), evil(3)] }
  window.renderPlatforms(parse({ yt: ai, tt: ai, ig: ai }))
  window.renderThumbnails(parse({ c: [{ name: evil(0), style: evil(1), headline: evil(2), subtext: evil(3), bg_color: 'red;position:fixed;inset:0;z-index:99999', accent_color: 'url(javascript:window.__pwned=5)', text_color: '#fff', layout: evil(0), subject: evil(1), why_it_works: evil(2) }] }).c)
  window.renderSEO(parse({ yt_titles: [{ title: evil(0), why: evil(1) }], description: evil(2), tags: [evil(3)], hashtags: [evil(0)], tiktok_caption: evil(1), tiktok_hashtags: [evil(2)], ig_caption: evil(3), ig_hashtags: [evil(0)] }))

  assert.equal(window.__pwned, undefined, 'injected script ran')
  assert.equal(document.scripts.length, before.script)
  assert.equal(document.querySelectorAll('img,svg,iframe,object,embed').length, before.media)
  for (const el of document.querySelectorAll('*')) for (const a of el.attributes) {
    if (/^on/i.test(a.name)) assert.ok(!/pwned/.test(a.value), `${el.tagName}.${a.name}=${a.value}`)
  }
  const thumbs = document.getElementById('thumb-concepts').innerHTML
  assert.ok(!/position:fixed/.test(thumbs) && !/javascript:/i.test(thumbs), 'colours are validated, not pasted into style attributes')
  assert.ok(document.getElementById('director-quote-wrap').textContent.includes(EVIL[0]), 'the payload is displayed as plain text')
})

test('render: normal text survives escaping intact (shown, copied and downloaded without entities)', async () => {
  const { window } = await open('index.html')
  const { document } = window
  window.eval(`S.selPlats=['yt']; S.genre='tutorial'; S.ctx='x'`)
  const tricky = `It's "great" & <fast>`
  const parse = o => window.parseJSON(JSON.stringify(o))
  window.renderSEO(parse({ yt_titles: [{ title: tricky, why: 'w' }], description: 'd', tags: ['t'] }))
  assert.equal(document.querySelector('.title-str').textContent, tricky)
  assert.equal(document.querySelector('.title-opt button').dataset.t, tricky, 'the copy button hands the original text to the clipboard')
  window.renderDirector(parse({ scenes: [{ timestamp: '0:00', action: 'KEEP', label: 'A & B', note: "Don't cut", dot: 'keep' }], director_note: 'n' }))
  assert.ok(document.getElementById('tl-copy').value.includes('A & B') && !document.getElementById('tl-copy').value.includes('&amp;'))
  window.renderChapters(parse({ c: [{ timestamp: '0:00', title: 'Q&A', description: 'd' }] }).c)
  assert.equal(document.getElementById('chap-copy').value, '0:00 Q&A')
})

test('run flow: sends only inputs to /api/generate, renders every section, queues one item per platform, reports partial failures', async () => {
  const { window } = await open('index.html')
  const { document } = window
  const calls = []
  let failTask = null
  window.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, headers: init.headers, body })
    if (body.task === failTask) return { ok: false, status: 502, json: async () => ({ error: 'The AI request failed. Try again.' }) }
    return { ok: true, status: 200, json: async () => ({ text: demoText(body) }) }
  }
  let alerted = ''
  window.alert = m => { alerted = m }
  document.getElementById('ctx').value = 'Lantern lighting devlog'
  window.eval(`S.selPlats=['yt','tt']`)
  failTask = 'seo'
  await window.runAll()

  assert.equal(calls.length, 7)
  for (const c of calls) {
    assert.equal(c.url, '/api/generate')
    assert.deepEqual(Object.keys(c.body).sort(), ['ctx', 'genre', 'platforms', 'task', 'transcript'], 'no model, no prompt, no key')
    assert.equal(c.headers['x-demo-role'], 'super_admin')
  }
  assert.match(alerted, /seo/)
  assert.ok(document.getElementById('director-content').style.display === 'block' && document.getElementById('chapters-content').style.display === 'block')
  const queue = JSON.parse(window.localStorage.getItem('dc_queue'))
  assert.deepEqual(queue.map(q => q.platform).sort(), ['tt', 'yt'])
  window.eval(`saveRunToStorage()`) // saving again (as "Send to dashboard" does) must not duplicate the run
  assert.equal(JSON.parse(window.localStorage.getItem('dc_runs')).length, 1)
  assert.equal(JSON.parse(window.localStorage.getItem('dc_queue')).length, 2)
})

test('run flow: a signed-out or forbidden caller sees the server message, not a fake success', async () => {
  const { window } = await open('index.html')
  window.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) })
  let alerted = ''
  window.alert = m => { alerted = m }
  window.document.getElementById('ctx').value = 'x'
  await window.runAll()
  assert.match(alerted, /Forbidden/)
  assert.equal(window.document.getElementById('run-btn').disabled, false, 'the button recovers so the user can retry')
})

test('dashboard: titles render as text, and "publish" is an honest manual checklist (no fake upload)', async () => {
  const runs = [{ id: 'run_1', timestamp: Date.now(), title: evil(0), platforms: ['yt'], genre: evil(1), status: 'draft' }]
  const queue = [{ id: 'run_1_yt', vid_id: 'run_1', platform: 'yt', title: evil(2), created: Date.now(), status: 'queued' }]
  const { window } = await open('dashboard.html', { beforeParse: w => { w.localStorage.setItem('dc_runs', JSON.stringify(runs)); w.localStorage.setItem('dc_queue', JSON.stringify(queue)) } })
  const { document } = window
  assert.equal(window.__pwned, undefined)
  assert.equal(document.querySelectorAll('#pub-queue img, #pub-queue svg, .vid-title img').length, 0)
  assert.ok(document.querySelector('.vid-title').textContent.includes(EVIL[0]))
  const btn = document.querySelector('#pub-queue button')
  assert.match(btn.textContent, /Mark published/)
  assert.ok(!/Connect/.test(document.getElementById('pub-queue').textContent), 'there is no platform connection to pretend about')
  btn.click() // synchronous: nothing is being uploaded
  assert.equal(JSON.parse(window.localStorage.getItem('dc_queue'))[0].status, 'published')
  assert.equal(JSON.parse(window.localStorage.getItem('dc_runs'))[0].status, 'published')
  assert.match(document.getElementById('toast').textContent, /Marked as published/)
})
