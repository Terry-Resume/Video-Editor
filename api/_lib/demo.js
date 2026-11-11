// Fictional canned results for demo mode (no key, no model call). Shaped exactly like the live JSON so the UI
// renders the same way. Every value is invented; the demo project is the fictional "Last Light" from @kato8/core.

const concept = 'Last Light devlog'

export const DEMO = {
  director: JSON.stringify({
    director_note: `The ${concept} lives or dies in the first twelve seconds. Open on the lantern flickering out, then explain the idea, not the other way around.`,
    score: 7, score_label: 'Strong concept, loose middle', estimated_duration: '18 min', recommended_duration: '11 min', cuts_count: 6, stream_specific_tips: null,
    scenes: [
      { timestamp: '00:00-00:45', action: 'KEEP', label: 'Cold open', note: 'Lead with the lantern moment.', dot: 'keep' },
      { timestamp: '00:45-03:30', action: 'TRIM', label: 'Studio intro', note: 'Cut to 30 seconds.', dot: 'trim' },
      { timestamp: '03:30-08:00', action: 'KEEP', label: 'Lighting system walkthrough', note: 'The strongest teaching beat.', dot: 'keep' },
      { timestamp: '08:00-10:15', action: 'CUT', label: 'Build-pipeline tangent', note: 'Save for a separate short.', dot: 'cut' },
    ],
    narrative_notes: 'Frame the video as a problem (the dark is unreadable) and a fix (the lantern rule). Each section should answer one viewer question.\n\nEnd on the before/after comparison rather than a recap.',
    retention_notes: 'Hold cuts to roughly one every six to eight seconds in the walkthrough. Put a pattern interrupt at the midpoint.',
  }),
  chapters: JSON.stringify({ chapters: [
    { timestamp: '0:00', title: 'Why the dark was unreadable', description: 'The problem in 30 seconds' },
    { timestamp: '0:45', title: 'The lantern rule', description: 'One light source the player controls' },
    { timestamp: '3:30', title: 'Lighting system walkthrough', description: 'Build it step by step' },
    { timestamp: '8:00', title: 'Before and after', description: 'Side-by-side comparison' },
    { timestamp: '10:15', title: 'What we would change', description: 'Open questions for the next build' },
  ] }),
  clips: JSON.stringify({ clips: [
    { timestamp: '00:00-00:30', duration: '30s', hook: 'This level was completely unplayable until one change.', why: 'Clear before/after promise', platforms: ['TikTok', 'Reels'], viral_score: 8, edit_note: 'Hard cut on the lantern flicker; captions on from frame one.' },
    { timestamp: '05:10-05:55', duration: '45s', hook: 'One light. That is the whole trick.', why: 'Self-contained teaching moment', platforms: ['TikTok', 'Reels', 'YouTube'], viral_score: 7, edit_note: 'Punch in on the lantern, add a beat on the reveal.' },
  ] }),
  platforms: p => Object.fromEntries(p.platforms.map(k => [k, {
    hook: 'Show the unplayable dark level for two seconds, then the fix.',
    cut_style: k === 'yt' ? 'Measured pacing with J-cuts between sections.' : 'Fast cuts, one idea per shot.',
    music_tip: 'Low ambient bed that ducks under narration.',
    caption_style: 'Large, high-contrast, two lines maximum.',
    cta: k === 'yt' ? 'Subscribe for the next devlog.' : 'Follow for the next fix.',
    post_time: 'Weekday evenings, local time',
    edit_checklist: ['Hook lands in 3 seconds', 'Captions burned in', 'Audio normalised', 'Safe-area margins respected', 'Cover frame chosen'],
  }])),
  thumbnail: JSON.stringify({ concepts: [
    { name: 'The Contrast', style: 'Split dark/lit', headline: 'UNPLAYABLE → FIXED', subtext: 'one lantern', bg_color: '#1a1a2e', accent_color: '#ff6b35', text_color: '#ffffff', layout: 'left-text right-image', subject: 'Lantern in a dark corridor', why_it_works: 'A clear before/after promise reads at thumbnail size.' },
    { name: 'The Question', style: 'Single large word', headline: 'WHY SO DARK?', subtext: '', bg_color: '#0b132b', accent_color: '#f4d35e', text_color: '#ffffff', layout: 'centered', subject: 'Player silhouette', why_it_works: 'Curiosity gap with minimal text.' },
    { name: 'The Number', style: 'Big numeral', headline: '1 LIGHT', subtext: 'that fixed it', bg_color: '#222222', accent_color: '#3ddc97', text_color: '#ffffff', layout: 'left-text right-image', subject: 'Lantern close-up', why_it_works: 'Specific numbers outperform vague claims.' },
  ] }),
  seo: JSON.stringify({
    yt_titles: [
      { title: 'How One Lantern Fixed Our Unplayable Dark Level', why: 'Specific problem and result' },
      { title: 'The Lighting Rule That Saved Last Light', why: 'Names the project and the payoff' },
      { title: 'Indie Game Lighting: The Lantern Rule Explained', why: 'Searchable phrase' },
    ],
    description: 'In this devlog we walk through how a single player-controlled light source made a previously unreadable level playable.\n\n[CHAPTERS]\n\nLast Light is a fictional demo project.',
    tags: ['indie game dev', 'game lighting', 'devlog', 'level design', 'unity lighting', 'game art', 'horror game', 'game design', 'behind the scenes', 'tutorial', 'lantern', 'dark game'],
    hashtags: ['#gamedev', '#indiedev', '#devlog', '#leveldesign', '#lighting'],
    tiktok_caption: 'This level was unplayable. One lantern fixed it.',
    tiktok_hashtags: ['#gamedev', '#indiegame', '#devlog', '#unity', '#lighting'],
    ig_caption: 'One light changed everything 🔦 Full devlog on YouTube.',
    ig_hashtags: ['#gamedev', '#indiedev', '#gamedesign', '#devlog', '#reels'],
  }),
  captions: '1\n00:00:00,000 --> 00:00:03,000\nThis level was completely\nunplayable.\n\n2\n00:00:03,000 --> 00:00:06,500\nThen we added one\nplayer-controlled light.\n',
}

/** Returns the canned model text for a task. */
export function demoText(input) {
  const v = DEMO[input.task]
  return typeof v === 'function' ? JSON.stringify(v(input)) : v
}
