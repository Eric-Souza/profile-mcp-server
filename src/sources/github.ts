// Public repos and READMEs from the GitHub REST API.

import { z } from 'zod'
import type { TtlCache } from '../cache.js'

const API = 'https://api.github.com'

export const ProjectSummarySchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  topics: z.array(z.string()),
  url: z.string(),
  stars: z.number(),
  updated_at: z.string(),
})

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>

interface RepoResponse {
  name: string
  description: string | null
  language: string | null
  topics?: string[]
  html_url: string
  stargazers_count: number
  pushed_at: string
  fork: boolean
  archived: boolean
}

function toSummary(repo: RepoResponse): ProjectSummary {
  return {
    name: repo.name,
    description: repo.description,
    language: repo.language,
    topics: repo.topics ?? [],
    url: repo.html_url,
    stars: repo.stargazers_count,
    updated_at: repo.pushed_at,
  }
}

export class GitHubSource {
  constructor(
    private username: string,
    private token: string | undefined,
    private cache: TtlCache,
    private fetchFn: typeof fetch = fetch,
  ) {}

  private async request(path: string, accept = 'application/vnd.github+json'): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: accept,
      'User-Agent': 'profile-mcp-server',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    const response = await this.fetchFn(`${API}${path}`, { headers })
    if (!response.ok) {
      const limited = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0'
      throw new Error(
        limited
          ? 'GitHub rate limit reached (60 requests/hour without a token). Set GITHUB_TOKEN to raise it.'
          : `GitHub ${path} returned ${response.status} ${response.statusText}`,
      )
    }
    return response
  }

  /** Public, non-fork repos, most recently pushed first. */
  listProjects(): Promise<ProjectSummary[]> {
    return this.cache.get(`github:repos:${this.username}`, async () => {
      const response = await this.request(`/users/${this.username}/repos?per_page=100&sort=pushed`)
      const repos = (await response.json()) as RepoResponse[]
      return repos.filter((r) => !r.fork && !r.archived).map(toSummary)
    })
  }

  /** One repo's metadata and README (empty if it has none). */
  getProject(name: string): Promise<ProjectSummary & { readme: string }> {
    return this.cache.get(`github:repo:${this.username}/${name}`, async () => {
      const path = `/repos/${this.username}/${encodeURIComponent(name)}`
      const repo = (await (await this.request(path)).json()) as RepoResponse
      let readme = ''
      try {
        readme = await (await this.request(`${path}/readme`, 'application/vnd.github.raw+json')).text()
      } catch (error) {
        if (!String(error).includes('404')) throw error
      }
      return { ...toSummary(repo), readme }
    })
  }
}
