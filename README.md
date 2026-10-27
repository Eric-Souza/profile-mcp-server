# Profile MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI assistants structured access to my professional profile: GitHub projects, Medium articles, and work experience. Connect it to Claude Desktop or Claude Code and ask things like *"Which of my projects use LangGraph?"* or *"Summarize my legal-tech experience"*. The assistant then calls tools instead of guessing.

It also feeds the [Job Application Copilot](https://github.com/Eric-Souza/job-application-copilot), which can load experience through this server instead of local files.

> **Status:** all five tools, the resume resource, and the prompt work over stdio and Streamable HTTP. Tested with Vitest and with a real MCP client over both transports.

## Tools

| Tool | What it does | Source |
|------|--------------|--------|
| `list_projects` | Lists public repos (no forks or archived ones) with description, language, topics, and last update, optionally filtered by `language` or `topic` | GitHub REST API |
| `get_project` | Returns a project's metadata and full README | GitHub REST API |
| `list_articles` | Lists recent articles with title, date, link, and tags | Medium RSS feed |
| `get_experience` | Returns roles, companies, dates, highlights, and stack, optionally filtered by `skill` or `industry` | `data/experience.json` |
| `search_profile` | Keyword search across projects, articles, and experience, best matches first | All of the above |

Every tool has a Zod input schema and an output schema, and returns its data both as structured content and as JSON text, for clients that don't read structured content yet. A source that fails (the GitHub rate limit, say) comes back as a tool error with a message that says what to do. `search_profile` skips the failing source, searches the others, and lists the failure under `errors`.

## Resources and prompts

- **Resource `profile://resume`:** the full resume as Markdown, in the format the Job Application Copilot indexes: one `### Title · Company (industry) | May 2025 – Present` heading per role and one bullet per accomplishment, so each bullet becomes a piece of evidence tagged with its role.
- **Prompt `tailor_for_job`:** takes a job posting and asks the model to match it against the profile using the tools above, without inventing experience.

```markdown
# Eric Souza

Senior Full Stack & AI Engineer

## Summary

Full stack and AI engineer with 8+ years of experience owning products from architecture to production, ...

## Experience

### Founding Full Stack & AI Engineer · TeamEx (legal-tech) | May 2025 – Present

Client: Essential Estates (Summerall Law)

- Built the platform from zero to production with React, TypeScript, NestJS, PostgreSQL and TypeORM.
- Set up and ran AWS infrastructure with GitHub Actions CI/CD.

## Projects

- **Job Application Copilot:** A LangGraph agent that tailors a resume to a job posting, ... Python, LangGraph, FastAPI, pgvector, React.

## Technical Skills

- **Languages:** TypeScript, JavaScript, Python, SQL
```

## Features

- [x] stdio transport for Claude Desktop and Claude Code
- [x] Streamable HTTP transport for remote clients (stateless, `POST /mcp`)
- [x] Zod-validated tool inputs and outputs
- [x] In-memory caching of GitHub and Medium responses (10 minutes by default; failed requests aren't cached)
- [x] Tests with Vitest (GitHub and Medium faked, no network), plus a stdio smoke test with a real MCP client
- [ ] Optional: read-only Postgres tool for querying the copilot's experience index

## Stack

TypeScript, Node.js 20+, [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk), Zod, Vitest.

## Project structure

```
profile-mcp-server/
  src/
    index.ts            # entry point: stdio, or Streamable HTTP with --http
    server.ts           # registers the tools, the resume resource, and the prompt
    config.ts           # environment variables and .env
    resume.ts           # the profile as copilot-format Markdown
    search.ts           # keyword scoring for search_profile
    cache.ts            # TTL cache for GitHub and Medium
    tools/              # one file per tool group
    sources/            # GitHub REST, Medium RSS, the local experience file
  data/
    experience.json     # roles, projects, and skills (a public sample)
  scripts/smoke.mjs     # launches the built server over stdio and calls it
  tests/
```

## Getting started

```bash
npm install
npm run build
npm test                 # 22 tests, no network
npm run smoke            # starts dist/index.js over stdio, lists the tools, prints the resume
```

Copy `.env.example` to `.env` to change the defaults. The server reads `.env` from the repo root, whatever directory the client starts it from, and variables a client passes win over the file.

| Variable | Default | What it does |
|---|---|---|
| `GITHUB_USERNAME` | `Eric-Souza` | Whose repos to list |
| `GITHUB_TOKEN` | none | Raises the GitHub API limit from 60 to 5,000 requests/hour |
| `MEDIUM_USERNAME` | `eric.bh18souza` | Whose feed to read |
| `PROFILE_EXPERIENCE_PATH` | `data/experience.json` | Your own profile file, relative to the repo or absolute |
| `CACHE_TTL_SECONDS` | `600` | How long GitHub and Medium responses are reused |
| `PORT` | `3000` | Port for `--http` |

### Your own profile

`data/experience.json` is a public sample. Put your full profile in `data/experience.local.json` (gitignored) and set `PROFILE_EXPERIENCE_PATH=data/experience.local.json`. The file is read on every call, so edits show up without a restart. Its shape:

```json
{
  "name": "Your Name",
  "headline": "Senior Engineer",
  "summary": "Two or three sentences.",
  "roles": [
    {
      "title": "Senior Engineer",
      "company": "Acme",
      "client": "Optional client name",
      "industry": "healthcare",
      "start": "2022-03",
      "end": null,
      "highlights": ["One accomplishment per entry"],
      "stack": ["Python", "React"]
    }
  ],
  "projects": [{ "name": "Side Project", "description": "What it does", "stack": ["Go"], "url": "https://..." }],
  "skills": { "Languages": ["Python", "Go"] }
}
```

## Connecting a client

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

**Over HTTP:**

```bash
npm run build && node dist/index.js --http      # http://localhost:3000/mcp
```

The HTTP transport is stateless (a new server per request, sharing one cache) and has no authentication, so run it on localhost or behind something that adds auth.

**MCP Inspector:** `npm run inspect` opens the Inspector against the built server, to call tools by hand.

## Free to run

Runs locally. The GitHub REST API (60 unauthenticated requests per hour, 5,000 with a token) and Medium RSS are free.
