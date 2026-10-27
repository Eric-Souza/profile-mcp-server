import type { TtlCache } from '../cache.js'
import type { CopilotIndex } from '../sources/copilot-index.js'
import type { Profile } from '../sources/experience.js'
import type { GitHubSource } from '../sources/github.js'
import type { MediumSource } from '../sources/medium.js'

/** What the tools read from, injectable for tests. */
export interface Sources {
  github: GitHubSource
  medium: MediumSource
  profile: () => Promise<Profile>
  cache: TtlCache
  /** Set when COPILOT_DATABASE_URL is; adds search_experience_index */
  copilotIndex?: CopilotIndex
}

/** A tool result with the same data as structured content and as JSON text, for older clients. */
export function result<T extends Record<string, unknown>>(data: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}
