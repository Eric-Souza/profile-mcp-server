// search_experience_index against PGlite (Postgres in WASM), with the copilot's tables minus the
// embedding column, which the search doesn't read.

import { PGlite } from '@electric-sql/pglite'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createServer, createSources } from '../src/server.js'
import { CopilotIndex, pgConnectionString } from '../src/sources/copilot-index.js'

const SCHEMA = `
CREATE TABLE sources (id varchar(36) PRIMARY KEY, filename varchar(512) NOT NULL UNIQUE);
CREATE TABLE experience_chunks (
  id varchar(64) PRIMARY KEY,
  source_id varchar(36) NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  section varchar(128) NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  heading text NOT NULL DEFAULT '',
  content text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', context || ' ' || content)) STORED
);
INSERT INTO sources VALUES ('s1', 'resume.md');
INSERT INTO experience_chunks (id, source_id, chunk_index, section, context, heading, content) VALUES
  ('c1', 's1', 0, 'Experience', 'AI Engineer · Clinic (healthcare)', 'AI Engineer · Clinic (healthcare)',
   'Built a RAG pipeline over clinical reports with pgvector.'),
  ('c2', 's1', 1, 'Experience', 'Backend Engineer · Shop', 'Backend Engineer · Shop',
   'Designed REST APIs in Python with FastAPI.'),
  ('c3', 's1', 2, 'Technical Skills', '', '', 'Python, TypeScript, PostgreSQL');
`

let db: PGlite
let index: CopilotIndex

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  index = new CopilotIndex(db)
})
afterAll(() => db.close())

describe('CopilotIndex', () => {
  it('matches any term of a long requirement, best matches first', async () => {
    const hits = await index.search('5+ years building REST APIs in Python', { limit: 10 })
    expect(hits.map((h) => h.content)).toEqual([
      'Designed REST APIs in Python with FastAPI.',
      'Python, TypeScript, PostgreSQL',
    ])
    expect(hits[0]).toMatchObject({ filename: 'resume.md', section: 'Experience', heading: 'Backend Engineer · Shop' })
    expect(hits[0].rank).toBeGreaterThan(hits[1].rank)
  })

  it('searches the role context too, and filters by section', async () => {
    const healthcare = await index.search('healthcare', { limit: 10 })
    expect(healthcare.map((h) => h.content)).toEqual(['Built a RAG pipeline over clinical reports with pgvector.'])
    const skills = await index.search('python', { section: 'technical skills', limit: 10 })
    expect(skills.map((h) => h.section)).toEqual(['Technical Skills'])
  })

  it('returns nothing for an empty or stopword-only query', async () => {
    expect(await index.search('  ', { limit: 10 })).toEqual([])
    expect(await index.search('the and of', { limit: 10 })).toEqual([])
  })

  it('says when the copilot has no index yet', async () => {
    const empty = new PGlite()
    await expect(new CopilotIndex(empty).search('python', { limit: 5 })).rejects.toThrow(/Ingest a resume/)
    await empty.close()
  })

  it("accepts the copilot's SQLAlchemy URL", () => {
    expect(pgConnectionString('postgresql+psycopg://copilot:copilot@localhost:5435/copilot')).toBe(
      'postgresql://copilot:copilot@localhost:5435/copilot',
    )
  })
})

describe('search_experience_index', () => {
  it('is registered only when the index is configured, and returns evidence', async () => {
    const sources = { ...createSources(loadConfig({})), copilotIndex: index }
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test', version: '1.0.0' })
    await Promise.all([createServer(sources).connect(serverSide), client.connect(clientSide)])

    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toContain('search_experience_index')
    const res = await client.callTool({ name: 'search_experience_index', arguments: { query: 'pgvector', limit: 1 } })
    expect((res.structuredContent as any).evidence[0].heading).toBe('AI Engineer · Clinic (healthcare)')
    await client.close()
  })
})
