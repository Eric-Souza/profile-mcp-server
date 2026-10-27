// Recent articles from a Medium user's RSS feed (Medium only puts the latest ~10 in it).

import { z } from 'zod'
import type { TtlCache } from '../cache.js'

export const ArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  published: z.string().describe('ISO date'),
  categories: z.array(z.string()),
})

export type Article = z.infer<typeof ArticleSchema>

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(text: string): string {
  const cdata = text.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  if (cdata) return cdata[1].trim()
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .trim()
}

function tags(xml: string, name: string): string[] {
  const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g')
  return [...xml.matchAll(pattern)].map((m) => decode(m[1]))
}

/** Parse the items of an RSS 2.0 feed. Only the fields the tools return. */
export function parseFeed(xml: string): Article[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const date = new Date(tags(item, 'pubDate')[0] ?? '')
    return {
      title: tags(item, 'title')[0] ?? '',
      // Medium appends tracking parameters to its links
      url: (tags(item, 'link')[0] ?? '').split('?')[0],
      published: Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10),
      categories: tags(item, 'category'),
    }
  })
}

export class MediumSource {
  constructor(
    private username: string,
    private cache: TtlCache,
    private fetchFn: typeof fetch = fetch,
  ) {}

  listArticles(): Promise<Article[]> {
    const user = this.username.replace(/^@/, '')
    return this.cache.get(`medium:${user}`, async () => {
      const response = await this.fetchFn(`https://medium.com/feed/@${user}`, {
        headers: { 'User-Agent': 'profile-mcp-server' },
      })
      if (!response.ok) throw new Error(`Medium feed returned ${response.status} ${response.statusText}`)
      return parseFeed(await response.text())
    })
  }
}
