import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { type CopilotIndex, EvidenceSchema } from '../sources/copilot-index.js'
import { result } from './shared.js'

export function registerCopilotTools(server: McpServer, index: CopilotIndex) {
  server.registerTool(
    'search_experience_index',
    {
      title: 'Search the copilot experience index',
      description:
        "Full-text search over the Job Application Copilot's indexed evidence: one chunk per resume " +
        'bullet, with the role it belongs to. Matches any term, best matches first, e.g. ' +
        'query="REST APIs in Python" or section="Experience".',
      inputSchema: {
        query: z.string().describe('Keywords or a full job requirement'),
        section: z.string().optional().describe('Only chunks from this resume section, e.g. Experience'),
        limit: z.number().int().min(1).max(50).default(10),
      },
      outputSchema: { evidence: z.array(EvidenceSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, section, limit }) => result({ evidence: await index.search(query, { section, limit }) }),
  )
}
