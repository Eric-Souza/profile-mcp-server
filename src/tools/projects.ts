import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ProjectSummarySchema } from '../sources/github.js'
import { result, type Sources } from './shared.js'

const READ_ONLY = { readOnlyHint: true, openWorldHint: true }

export function registerProjectTools(server: McpServer, sources: Sources) {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'Public GitHub repos with description, language, topics, and last update, most recent first. ' +
        'Filter by language or topic.',
      inputSchema: {
        language: z.string().optional().describe('e.g. Python, TypeScript'),
        topic: z.string().optional().describe('A GitHub topic, e.g. langgraph'),
      },
      outputSchema: { projects: z.array(ProjectSummarySchema) },
      annotations: READ_ONLY,
    },
    async ({ language, topic }) => {
      let projects = await sources.github.listProjects()
      if (language) projects = projects.filter((p) => p.language?.toLowerCase() === language.toLowerCase())
      if (topic) projects = projects.filter((p) => p.topics.includes(topic.toLowerCase()))
      return result({ projects })
    },
  )

  server.registerTool(
    'get_project',
    {
      title: 'Get a project',
      description: "A GitHub repo's metadata and full README.",
      inputSchema: { name: z.string().describe('The repo name, e.g. job-application-copilot') },
      outputSchema: { ...ProjectSummarySchema.shape, readme: z.string() },
      annotations: READ_ONLY,
    },
    async ({ name }) => result(await sources.github.getProject(name)),
  )
}
