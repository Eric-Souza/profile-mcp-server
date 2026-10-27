// Build the MCP server: tools, the resume resource, and the tailor_for_job prompt.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TtlCache } from './cache.js'
import type { Config } from './config.js'
import { renderResume } from './resume.js'
import { loadProfile } from './sources/experience.js'
import { GitHubSource } from './sources/github.js'
import { MediumSource } from './sources/medium.js'
import { registerArticleTools } from './tools/articles.js'
import { registerExperienceTools } from './tools/experience.js'
import { registerProjectTools } from './tools/projects.js'
import { registerSearchTool } from './tools/search.js'
import type { Sources } from './tools/shared.js'

export const RESUME_URI = 'profile://resume'

export function createSources(config: Config, fetchFn: typeof fetch = fetch): Sources {
  const cache = new TtlCache(config.cacheTtlMs)
  return {
    github: new GitHubSource(config.githubUsername, config.githubToken, cache, fetchFn),
    medium: new MediumSource(config.mediumUsername, cache, fetchFn),
    profile: () => loadProfile(config.experiencePath),
    cache,
  }
}

export function createServer(sources: Sources): McpServer {
  const server = new McpServer({ name: 'profile-mcp-server', version: '0.1.0' })

  registerProjectTools(server, sources)
  registerArticleTools(server, sources)
  registerExperienceTools(server, sources)
  registerSearchTool(server, sources)

  server.registerResource(
    'resume',
    RESUME_URI,
    {
      title: 'Resume',
      description:
        'The full resume as Markdown: summary, experience (one bullet per accomplishment), projects, ' +
        'and skills. Same format as the Job Application Copilot reads.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: renderResume(await sources.profile()) }],
    }),
  )

  server.registerPrompt(
    'tailor_for_job',
    {
      title: 'Tailor for a job',
      description: 'Match a job posting against the profile, using the tools to find evidence.',
      argsSchema: { posting: z.string().describe('The full job posting') },
    },
    ({ posting }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Compare this job posting with my profile.',
              '',
              '1. List the posting\'s must-have and nice-to-have requirements.',
              `2. For each one, find evidence with get_experience, search_profile, and list_projects, or read ${RESUME_URI}.`,
              '3. Mark each requirement strong, partial, or missing, and name the evidence.',
              '4. Suggest 4 to 6 resume bullets for this role, using only that evidence. Never invent experience.',
              '',
              'Job posting:',
              '',
              posting.trim(),
            ].join('\n'),
          },
        },
      ],
    }),
  )

  return server
}
