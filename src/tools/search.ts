import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { search, SearchHitSchema, type Searchable } from '../search.js'
import { roleHeading } from '../resume.js'
import { result, type Sources } from './shared.js'

/** Everything searchable. A source that fails (GitHub rate limit, say) is skipped and reported. */
async function collect(sources: Sources): Promise<{ items: Searchable[]; errors: string[] }> {
  const errors: string[] = []
  const settle = async <T>(label: string, load: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await load()
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  }
  const [projects, articles, profile] = await Promise.all([
    settle('GitHub', () => sources.github.listProjects()),
    settle('Medium', () => sources.medium.listArticles()),
    settle('Experience', async () => [await sources.profile()]),
  ])

  const items: Searchable[] = [
    ...projects.map((p) => ({
      kind: 'project' as const,
      title: p.name,
      snippet: p.description ?? '',
      url: p.url,
      text: [p.description, p.language, ...p.topics].join(' '),
    })),
    ...articles.map((a) => ({
      kind: 'article' as const,
      title: a.title,
      snippet: `${a.published} · ${a.categories.join(', ')}`,
      url: a.url,
      text: a.categories.join(' '),
    })),
  ]
  for (const role of profile[0]?.roles ?? []) {
    const heading = roleHeading(role)
    items.push({
      kind: 'role',
      title: heading,
      snippet: role.stack.join(', '),
      url: null,
      text: [role.client, role.industry, ...role.stack].join(' '),
    })
    for (const highlight of role.highlights) {
      items.push({ kind: 'highlight', title: heading, snippet: highlight, url: null, text: highlight })
    }
  }
  for (const p of profile[0]?.projects ?? []) {
    items.push({
      kind: 'profile_project',
      title: p.name,
      snippet: p.description,
      url: p.url ?? null,
      text: [p.description, ...p.stack].join(' '),
    })
  }
  return { items, errors }
}

export function registerSearchTool(server: McpServer, sources: Sources) {
  server.registerTool(
    'search_profile',
    {
      title: 'Search the profile',
      description:
        'Keyword search across GitHub projects, Medium articles, and work experience. Returns the best ' +
        'matches first. Sources that could not be reached are listed under errors.',
      inputSchema: {
        query: z.string().min(1).describe('Keywords, e.g. "LangGraph Postgres"'),
        limit: z.number().int().min(1).max(50).optional().describe('Default 10'),
      },
      outputSchema: { hits: z.array(SearchHitSchema), errors: z.array(z.string()) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      const { items, errors } = await collect(sources)
      return result({ hits: search(items, query, limit ?? 10), errors })
    },
  )
}
