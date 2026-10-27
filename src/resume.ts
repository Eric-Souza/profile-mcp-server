// Render the profile as Markdown in the format the Job Application Copilot indexes:
//
//   # Name                                           (ignored by the copilot)
//   ## Experience                                    -> section
//   ### Title · Company (industry) | May 2025 – Present   -> the role, stored with each bullet
//   Client: ...                                      -> a line under a role adds to its context
//   - One accomplishment.                            -> one chunk
//
// See job-application-copilot/data/resume/README.md.

import type { Profile, Role } from './sources/experience.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2025-05" -> "May 2025"; a bare year stays as it is. */
export function formatMonth(value: string): string {
  const [year, month] = value.split('-')
  const index = Number(month) - 1
  return month && MONTHS[index] ? `${MONTHS[index]} ${year}` : year
}

/** The role heading: "Title · Company (industry) | May 2025 – Present". */
export function roleHeading(role: Role): string {
  const company = role.industry ? `${role.company} (${role.industry})` : role.company
  const dates = `${formatMonth(role.start)} – ${role.end ? formatMonth(role.end) : 'Present'}`
  return `${role.title} · ${company} | ${dates}`
}

const sentence = (text: string) => {
  const t = text.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

export function renderResume(profile: Profile): string {
  const out: string[] = []
  if (profile.name) out.push(`# ${profile.name}`, '')
  if (profile.headline) out.push(profile.headline, '')
  if (profile.summary) out.push('## Summary', '', profile.summary.trim(), '')

  if (profile.roles.length) {
    out.push('## Experience', '')
    for (const role of profile.roles) {
      out.push(`### ${roleHeading(role)}`, '')
      if (role.client) out.push(`Client: ${role.client}`, '')
      out.push(...role.highlights.map((h) => `- ${sentence(h)}`), '')
    }
  }

  if (profile.projects.length) {
    out.push('## Projects', '')
    for (const p of profile.projects) {
      const stack = p.stack.length ? ` ${p.stack.join(', ')}.` : ''
      out.push(`- **${p.name}:** ${sentence(p.description)}${stack}`)
    }
    out.push('')
  }

  const skills = Object.entries(profile.skills).filter(([, list]) => list.length)
  if (skills.length) {
    out.push('## Technical Skills', '')
    out.push(...skills.map(([category, list]) => `- **${category}:** ${list.join(', ')}`), '')
  }
  return out.join('\n').trimEnd() + '\n'
}
