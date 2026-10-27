// Read-only full-text search over the Job Application Copilot's experience index (Postgres).
// Keyword search only: vector search would need the copilot's embedding model.

import pg from 'pg'
import { z } from 'zod'

export const EvidenceSchema = z.object({
  filename: z.string().describe('The ingested file the chunk came from'),
  section: z.string().describe('Top-level resume section, e.g. "Experience"'),
  heading: z.string().describe('The role the chunk sits under; empty for top-level bullets'),
  content: z.string(),
  rank: z.number().describe('ts_rank_cd score, higher is better'),
})

export type Evidence = z.infer<typeof EvidenceSchema>

/** The part of pg.Pool the index uses, so tests can pass an in-process Postgres. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>
}

// The copilot's own keyword search: OR the query's lexemes, parsed with the same 'english'
// config as the chunks' tsv column, so a long requirement matches chunks sharing any term.
const SEARCH_SQL = `
WITH q AS (
  SELECT to_tsquery('simple', coalesce(string_agg(quote_literal(lexeme), ' | '), '')) AS query
  FROM unnest(to_tsvector('english', $1))
)
SELECT s.filename, c.section, c.heading, c.content, ts_rank_cd(c.tsv, q.query) AS rank
FROM experience_chunks c
JOIN sources s ON s.id = c.source_id, q
WHERE c.tsv @@ q.query AND ($2::text IS NULL OR c.section ILIKE $2)
ORDER BY rank DESC, s.filename, c.chunk_index
LIMIT $3`

/** The copilot's DATABASE_URL works as is: SQLAlchemy's "+psycopg" driver suffix is dropped. */
export function pgConnectionString(url: string): string {
  return url.replace(/^postgres(ql)?\+\w+:/, 'postgresql:')
}

export class CopilotIndex {
  constructor(private db: Queryable) {}

  static connect(url: string): CopilotIndex {
    // Every session is read-only, so the tool can't write even if the query were changed
    const pool = new pg.Pool({
      connectionString: pgConnectionString(url),
      options: '-c default_transaction_read_only=on',
      max: 2,
      connectionTimeoutMillis: 5000,
    })
    // An idle client losing its connection must not crash a stdio server
    pool.on('error', () => {})
    return new CopilotIndex(pool)
  }

  async search(query: string, { section, limit }: { section?: string; limit: number }): Promise<Evidence[]> {
    if (!query.trim()) return []
    try {
      const { rows } = await this.db.query(SEARCH_SQL, [query, section ?? null, limit])
      return rows.map((r) => ({ ...r, rank: Number(r.rank) }))
    } catch (error) {
      // pg reports a refused connection as an AggregateError with an empty message
      const message = (error instanceof Error && error.message) || (error as { code?: string }).code || String(error)
      if (/experience_chunks|sources/.test(message) && /does not exist/.test(message)) {
        throw new Error('The copilot database has no experience index yet. Ingest a resume in the copilot first.')
      }
      throw new Error(`Copilot database: ${message}. Check COPILOT_DATABASE_URL and that Postgres is running.`)
    }
  }
}
