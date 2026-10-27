// Work experience from a local JSON file: data/experience.json, or PROFILE_EXPERIENCE_PATH.

import { readFile } from 'node:fs/promises'
import { z } from 'zod'

export const RoleSchema = z.object({
  title: z.string(),
  company: z.string(),
  client: z.string().nullish(),
  industry: z.string().nullish(),
  start: z.string().describe('YYYY-MM'),
  end: z.string().nullable().describe('YYYY-MM, or null for a current role'),
  highlights: z.array(z.string()),
  stack: z.array(z.string()).default([]),
})

export const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  stack: z.array(z.string()).default([]),
  url: z.string().nullish(),
})

export const ProfileSchema = z.object({
  name: z.string().default(''),
  headline: z.string().default(''),
  summary: z.string().default(''),
  roles: z.array(RoleSchema),
  projects: z.array(ProjectSchema).default([]),
  // Category -> skills, e.g. { "Languages": ["Python", "Go"] }
  skills: z.record(z.string(), z.array(z.string())).default({}),
})

export type Role = z.infer<typeof RoleSchema>
export type Project = z.infer<typeof ProjectSchema>
export type Profile = z.infer<typeof ProfileSchema>

/** Read and validate the profile file. Read on every call, so edits show up without a restart. */
export async function loadProfile(path: string): Promise<Profile> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch {
    throw new Error(`Can't read the experience file at ${path}`)
  }
  const parsed = ProfileSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    throw new Error(`${path} doesn't match the profile format: ${parsed.error.message}`)
  }
  return parsed.data
}

const norm = (s: string) => s.toLowerCase().trim()

/** Roles that used a skill (stack or highlights) and/or are in an industry, matched case-insensitively. */
export function filterRoles(roles: Role[], filters: { skill?: string; industry?: string }): Role[] {
  return roles.filter((role) => {
    if (filters.skill) {
      const skill = norm(filters.skill)
      const inStack = role.stack.some((s) => norm(s) === skill)
      const inHighlights = role.highlights.some((h) => norm(h).includes(skill))
      if (!inStack && !inHighlights) return false
    }
    if (filters.industry && !norm(role.industry ?? '').includes(norm(filters.industry))) return false
    return true
  })
}
