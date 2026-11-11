import { requireUser as realRequireUser, createMessage as realCreateMessage, isDemo } from '@kato8/core/server'
import { getTool } from '@kato8/core'
import { parseInput, buildPrompt } from './prompts.js'
import { demoText } from './demo.js'

/** Roles come from the suite registry, so this route and the UI gate can never disagree. */
export const VIDEO_ROLES = getTool('video').roles

/**
 * POST /api/generate  { task, ctx, genre, platforms, transcript }  ->  { text }
 * Dependencies are injectable so the auth/limits/model rules can be tested without a network.
 */
export function makeGenerateHandler({ requireUser = realRequireUser, createMessage = realCreateMessage, env = () => process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (!(await requireUser(req, res, { roles: VIDEO_ROLES }))) return

    const parsed = parseInput(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    const input = parsed.value

    const e = env()
    if (isDemo(e)) return res.json({ text: demoText(input), demo: true })

    const { prompt, maxTokens } = buildPrompt(input)
    // The client never supplies a model or a token limit; both come from the server.
    const out = await createMessage({ messages: [{ role: 'user', content: prompt }] }, { tier: 'standard', kind: 'video', maxTokens, env: e })
    if (out.status !== 200) {
      const status = out.status === 503 ? 503 : 502
      return res.status(status).json({ error: status === 503 ? 'AI is not configured' : 'The AI request failed. Try again.' })
    }
    const text = (out.data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    if (!text) return res.status(502).json({ error: 'The AI returned an empty answer. Try again.' })
    return res.json({ text })
  }
}
