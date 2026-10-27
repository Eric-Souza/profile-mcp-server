import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { formatMonth, renderResume, roleHeading } from '../src/resume.js'
import { loadProfile, type Profile } from '../src/sources/experience.js'

const PROFILE: Profile = {
  name: 'Alex Rivera',
  headline: 'Backend & AI Engineer',
  summary: 'Backend engineer who ships LLM features.',
  roles: [
    {
      title: 'Senior Backend Engineer',
      company: 'Parcelly',
      industry: 'logistics',
      client: 'Northwind Freight',
      start: '2023-03',
      end: null,
      highlights: ['Built a delivery-time prediction service in Python', 'Mentored three engineers.'],
      stack: ['Python'],
    },
    {
      title: 'Backend Engineer',
      company: 'Paylane',
      start: '2020-01',
      end: '2023-02',
      highlights: ['Designed a payments API in Go'],
      stack: ['Go'],
    },
  ],
  projects: [{ name: 'Recipe Scout', description: 'A LangGraph meal planner', stack: ['Python', 'React'] }],
  skills: { Languages: ['Python', 'Go'], Empty: [] },
}

describe('renderResume', () => {
  it("matches the copilot's resume format", () => {
    expect(renderResume(PROFILE)).toBe(
      [
        '# Alex Rivera',
        '',
        'Backend & AI Engineer',
        '',
        '## Summary',
        '',
        'Backend engineer who ships LLM features.',
        '',
        '## Experience',
        '',
        '### Senior Backend Engineer · Parcelly (logistics) | Mar 2023 – Present',
        '',
        'Client: Northwind Freight',
        '',
        '- Built a delivery-time prediction service in Python.',
        '- Mentored three engineers.',
        '',
        '### Backend Engineer · Paylane | Jan 2020 – Feb 2023',
        '',
        '- Designed a payments API in Go.',
        '',
        '## Projects',
        '',
        '- **Recipe Scout:** A LangGraph meal planner. Python, React.',
        '',
        '## Technical Skills',
        '',
        '- **Languages:** Python, Go',
        '',
      ].join('\n'),
    )
  })

  it('gives every bullet a role heading the copilot can tag it with', async () => {
    const markdown = renderResume(await loadProfile('data/experience.json'))
    const lines = markdown.split('\n')
    let section = ''
    let role = ''
    for (const line of lines) {
      if (line.startsWith('## ')) [section, role] = [line.slice(3), '']
      else if (line.startsWith('### ')) role = line.slice(4)
      else if (line.startsWith('- ') && section === 'Experience') {
        expect(role).toMatch(/^.+ · .+ \| [A-Z][a-z]{2} \d{4} – (Present|[A-Z][a-z]{2} \d{4})$/)
        expect(line).toMatch(/\.$/)
      }
    }
    expect(lines.filter((l) => l.startsWith('# '))).toHaveLength(1) // only the name is level 1
  })

  it('leaves out empty sections', () => {
    const markdown = renderResume({ ...PROFILE, summary: '', projects: [], skills: {} })
    expect(markdown).not.toMatch(/## (Summary|Projects|Technical Skills)/)
  })
})

describe('dates', () => {
  it('formats months and keeps bare years', () => {
    expect(formatMonth('2025-05')).toBe('May 2025')
    expect(formatMonth('2019')).toBe('2019')
    expect(roleHeading(PROFILE.roles[1])).toBe('Backend Engineer · Paylane | Jan 2020 – Feb 2023')
  })
})

describe('the sample profile', () => {
  it('is valid', async () => {
    const raw = JSON.parse(await readFile('data/experience.json', 'utf-8'))
    const profile = await loadProfile('data/experience.json')
    expect(profile.roles.length).toBe(raw.roles.length)
  })

  it('reports a bad file clearly', async () => {
    await expect(loadProfile('data/missing.json')).rejects.toThrow(/Can't read the experience file/)
  })
})
