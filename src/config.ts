import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// dist/config.js or src/config.ts -> the repo root. MCP clients launch the server from any
// directory, so relative paths are resolved from here rather than the working directory.
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

export interface Config {
  githubUsername: string
  githubToken?: string
  mediumUsername: string
  experiencePath: string
  cacheTtlMs: number
}

/** Load the repo's .env into process.env, if there is one. Variables already set win. */
export function loadEnvFile(): void {
  const path = resolve(REPO_ROOT, '.env')
  if (existsSync(path)) process.loadEnvFile(path)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    githubUsername: env.GITHUB_USERNAME || 'Eric-Souza',
    githubToken: env.GITHUB_TOKEN || undefined,
    mediumUsername: env.MEDIUM_USERNAME || 'eric.bh18souza',
    experiencePath: resolve(REPO_ROOT, env.PROFILE_EXPERIENCE_PATH || 'data/experience.json'),
    cacheTtlMs: Number(env.CACHE_TTL_SECONDS || 600) * 1000,
  }
}
