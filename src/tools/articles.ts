import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ArticleSchema } from '../sources/medium.js'
import { result, type Sources } from './shared.js'

export function registerArticleTools(server: McpServer, sources: Sources) {
  server.registerTool(
    'list_articles',
    {
      title: 'List articles',
      description: 'Recent Medium articles with title, date, link, and tags (the feed holds the latest ~10).',
      inputSchema: { limit: z.number().int().min(1).max(20).optional().describe('Default 10') },
      outputSchema: { articles: z.array(ArticleSchema) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ limit }) => {
      const articles = await sources.medium.listArticles()
      return result({ articles: articles.slice(0, limit ?? 10) })
    },
  )
}
