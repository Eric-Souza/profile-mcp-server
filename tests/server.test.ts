// The server end to end over an in-memory transport, with GitHub and Medium faked.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createServer, createSources, RESUME_URI } from '../src/server.js'

const REPOS = [
  {
    name: 'job-application-copilot',
    description: 'LangGraph agent that tailors your resume',
    language: 'Python',
    topics: ['langgraph', 'rag'],
    html_url: 'https://github.com/me/job-application-copilot',
    stargazers_count: 3,
    pushed_at: '2026-10-26T00:00:00Z',
    fork: false,
    archived: false,
  },
  {
    name: 'portfolio',
    description: 'Personal site',
    language: 'TypeScript',
    topics: [],
    html_url: 'https://github.com/me/portfolio',
    stargazers_count: 0,
    pushed_at: '2026-10-20T00:00:00Z',
    fork: false,
    archived: false,
  },
  { name: 'someone-elses', fork: true, archived: false, topics: [] },
]

const FEED = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Production RAG with pgvector]]></title>
<link>https://medium.com/@me/production-rag-123?source=rss</link>
<category><![CDATA[rag]]></category><category><![CDATA[postgres]]></category>
<pubDate>Sat, 24 Oct 2026 12:00:00 GMT</pubDate></item>
<item><title>Exchange rates &amp; timing</title><link>https://medium.com/@me/usd-brl-456</link>
<pubDate>Thu, 22 Oct 2026 12:00:00 GMT</pubDate></item>
</channel></rss>`

function fakeFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/users/me/repos')) return Response.json(REPOS)
    if (url.endsWith('/repos/me/job-application-copilot')) return Response.json(REPOS[0])
    if (url.endsWith('/repos/me/job-application-copilot/readme')) return new Response('# Job Application Copilot')
    if (url.endsWith('/repos/me/no-readme')) return Response.json({ ...REPOS[1], name: 'no-readme' })
    if (url.includes('medium.com/feed/@me')) return new Response(FEED)
    return new Response('not found', { status: 404, statusText: 'Not Found' })
  })
}

let client: Client
let fetchMock: ReturnType<typeof fakeFetch>

async function connect(env: Record<string, string> = {}) {
  fetchMock = fakeFetch()
  const config = loadConfig({ GITHUB_USERNAME: 'me', MEDIUM_USERNAME: 'me', ...env })
  const server = createServer(createSources(config, fetchMock as typeof fetch))
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args })
  return res as { structuredContent?: Record<string, any>; isError?: boolean; content: { text: string }[] }
}

beforeEach(() => connect())
afterEach(() => client.close())

describe('tools', () => {
  it('lists the tools, the resume resource, and the prompt', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_experience',
      'get_project',
      'list_articles',
      'list_projects',
      'search_profile',
    ])
    expect(tools.every((t) => t.outputSchema)).toBe(true)
    const { resources } = await client.listResources()
    expect(resources.map((r) => r.uri)).toEqual([RESUME_URI])
    const { prompts } = await client.listPrompts()
    expect(prompts.map((p) => p.name)).toEqual(['tailor_for_job'])
  })

  it('lists projects without forks, filtered by language or topic', async () => {
    const all = await call('list_projects')
    expect(all.structuredContent?.projects.map((p: any) => p.name)).toEqual(['job-application-copilot', 'portfolio'])
    const python = await call('list_projects', { language: 'python' })
    expect(python.structuredContent?.projects).toHaveLength(1)
    const tagged = await call('list_projects', { topic: 'LangGraph' })
    expect(tagged.structuredContent?.projects[0].name).toBe('job-application-copilot')
  })

  it('caches GitHub responses', async () => {
    await call('list_projects')
    await call('list_projects')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns a project with its README, or an empty one if it has none', async () => {
    const project = await call('get_project', { name: 'job-application-copilot' })
    expect(project.structuredContent?.readme).toBe('# Job Application Copilot')
    const bare = await call('get_project', { name: 'no-readme' })
    expect(bare.structuredContent?.readme).toBe('')
  })

  it('reports GitHub errors as tool errors', async () => {
    const missing = await call('get_project', { name: 'nope' })
    expect(missing.isError).toBe(true)
    expect(missing.content[0].text).toMatch(/404/)
  })

  it('explains the GitHub rate limit', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 403, statusText: 'Forbidden', headers: { 'x-ratelimit-remaining': '0' } }),
    )
    const limited = await call('list_projects')
    expect(limited.content[0].text).toMatch(/GITHUB_TOKEN/)
  })

  it('sends the token when one is set', async () => {
    await client.close()
    await connect({ GITHUB_TOKEN: 'secret' })
    await call('list_projects')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret')
  })

  it('parses the Medium feed', async () => {
    const { structuredContent } = await call('list_articles', { limit: 5 })
    expect(structuredContent?.articles).toEqual([
      {
        title: 'Production RAG with pgvector',
        url: 'https://medium.com/@me/production-rag-123',
        published: '2026-10-24',
        categories: ['rag', 'postgres'],
      },
      { title: 'Exchange rates & timing', url: 'https://medium.com/@me/usd-brl-456', published: '2026-10-22', categories: [] },
    ])
  })

  it('filters experience by skill and industry', async () => {
    const rag = await call('get_experience', { skill: 'rag' })
    expect(rag.structuredContent?.roles).toHaveLength(1)
    const legal = await call('get_experience', { industry: 'Legal' })
    expect(legal.structuredContent?.roles).toHaveLength(1)
    const none = await call('get_experience', { industry: 'healthcare' })
    expect(none.structuredContent?.roles).toEqual([])
  })

  it('searches across projects, articles, and experience', async () => {
    const { structuredContent } = await call('search_profile', { query: 'RAG' })
    const kinds = new Set(structuredContent?.hits.map((h: any) => h.kind))
    expect(kinds).toEqual(new Set(['project', 'article', 'role', 'highlight', 'profile_project']))
    expect(structuredContent?.errors).toEqual([])
  })

  it('still searches the other sources when one fails', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).includes('medium')
        ? new Response(FEED)
        : new Response('', { status: 500, statusText: 'Server Error' }),
    )
    const { structuredContent } = await call('search_profile', { query: 'pgvector' })
    expect(structuredContent?.hits[0].kind).toBe('article')
    expect(structuredContent?.errors[0]).toMatch(/^GitHub: /)
  })
})

describe('resource and prompt', () => {
  it('serves the resume as Markdown', async () => {
    const { contents } = await client.readResource({ uri: RESUME_URI })
    expect(contents[0].mimeType).toBe('text/markdown')
    expect(contents[0].text).toContain('## Experience')
    expect(contents[0].text).toMatch(/### .+ · .+ \| .+ – Present/)
  })

  it('builds the tailor_for_job prompt around the posting', async () => {
    const prompt = await client.getPrompt({ name: 'tailor_for_job', arguments: { posting: '  Senior AI Engineer  ' } })
    const text = (prompt.messages[0].content as { text: string }).text
    expect(text).toMatch(/Senior AI Engineer$/)
    expect(text).toContain('get_experience')
  })
})
