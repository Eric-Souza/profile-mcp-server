import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { filterRoles, RoleSchema } from '../sources/experience.js'
import { result, type Sources } from './shared.js'

export function registerExperienceTools(server: McpServer, sources: Sources) {
  server.registerTool(
    'get_experience',
    {
      title: 'Get work experience',
      description:
        'Roles with company, dates, highlights, and stack. Filter by a skill (matched against the ' +
        'stack and highlights) or an industry, e.g. skill="RAG" or industry="healthcare".',
      inputSchema: {
        skill: z.string().optional(),
        industry: z.string().optional(),
      },
      outputSchema: { roles: z.array(RoleSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ skill, industry }) => {
      const profile = await sources.profile()
      return result({ roles: filterRoles(profile.roles, { skill, industry }) })
    },
  )
}
