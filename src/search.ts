// Keyword search across projects, articles, and experience. Plain term matching, no index:
// the whole profile is a few dozen items.

import { z } from 'zod'

export const SearchHitSchema = z.object({
  kind: z.enum(['project', 'article', 'role', 'highlight', 'profile_project']),
  title: z.string(),
  snippet: z.string(),
  url: z.string().nullable(),
  score: z.number(),
})

export type SearchHit = z.infer<typeof SearchHitSchema>

export interface Searchable {
  kind: SearchHit['kind']
  title: string
  snippet: string
  url: string | null
  // Text matched against the query. Title matches count double.
  text: string
}

export function terms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}+#.]+/u).filter((t) => t.length > 1))]
}

export function search(items: Searchable[], query: string, limit = 10): SearchHit[] {
  const wanted = terms(query)
  if (!wanted.length) return []
  const hits: SearchHit[] = []
  for (const item of items) {
    const title = item.title.toLowerCase()
    const text = item.text.toLowerCase()
    let score = 0
    for (const term of wanted) {
      if (title.includes(term)) score += 2
      else if (text.includes(term)) score += 1
    }
    if (score > 0) {
      hits.push({ kind: item.kind, title: item.title, snippet: item.snippet, url: item.url, score })
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
