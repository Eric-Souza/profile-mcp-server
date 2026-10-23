# Profile MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI assistants structured access to my professional profile: GitHub projects, Medium articles, and work experience. Connect it to Claude Desktop or Claude Code and ask things like *"Which of my projects use LangGraph?"* or *"Summarize my healthcare experience"*. The assistant then calls tools instead of guessing.

It also feeds the [Job Application Copilot](https://github.com/Eric-Souza/job-application-copilot), which can load experience through this server instead of local files.

> **Status:** planning and project structure. Implementation in progress.

## Tools

| Tool | What it does | Source |
|------|--------------|--------|
| `list_projects` | Lists public repos with description, language, topics, and last update | GitHub REST API |
| `get_project` | Returns a project's README and metadata | GitHub REST API |
| `list_articles` | Lists recent articles with title, date, and link | Medium RSS feed |
| `get_experience` | Returns roles, companies, dates, highlights, and stack, optionally filtered by skill or industry | `data/experience.json` |
| `search_profile` | Keyword search across projects, articles, and experience | All of the above |

## Resources and prompts

- **Resource `profile://resume`:** the full resume as Markdown.
- **Prompt `tailor_for_job`:** takes a job posting and asks the model to match it against the profile using the tools above.

## Planned features

- [ ] stdio transport for Claude Desktop and Claude Code
- [ ] Streamable HTTP transport for remote clients
- [ ] Zod-validated tool inputs and outputs
- [ ] In-memory caching of GitHub and Medium responses
- [ ] Tests with Vitest, plus manual checks with the MCP Inspector
- [ ] Optional: read-only Postgres tool for querying the copilot's experience index

## Stack

TypeScript, Node.js 20+, [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk), Zod, Vitest.

## Project structure

```
profile-mcp-server/
  src/
    index.ts            # server setup, transport selection
    tools/              # one file per tool
    sources/            # GitHub, Medium RSS, local experience loaders
  data/
    experience.json     # roles and highlights (sample included)
  tests/
  docs/                 # screenshots, client setup notes
```

## Connecting a client (once implemented)

**Claude Code:**

```bash
claude mcp add profile -- node /path/to/profile-mcp-server/dist/index.js
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "profile": {
      "command": "node",
      "args": ["/path/to/profile-mcp-server/dist/index.js"],
      "env": { "GITHUB_USERNAME": "Eric-Souza", "MEDIUM_USERNAME": "eric.bh18souza" }
    }
  }
}
```

## Free to run

Runs locally. The GitHub REST API (60 unauthenticated requests per hour, 5,000 with a token) and Medium RSS are free.
