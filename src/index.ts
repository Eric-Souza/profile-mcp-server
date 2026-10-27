#!/usr/bin/env node
// Server entry point: stdio by default (Claude Desktop, Claude Code), Streamable HTTP with --http.
//
//   node dist/index.js                 stdio
//   node dist/index.js --http          http://localhost:3000/mcp (PORT to change it)

import { createServer as createHttpServer, type IncomingMessage } from 'node:http'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { loadConfig, loadEnvFile } from './config.js'
import { createServer, createSources } from './server.js'

// stdout carries the protocol in stdio mode, so everything else goes to stderr
const log = (...args: unknown[]) => console.error('[profile-mcp]', ...args)

loadEnvFile()
const config = loadConfig()
const sources = createSources(config)

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = Buffer.concat(chunks).toString('utf-8')
  return body ? JSON.parse(body) : undefined
}

async function serveHttp(port: number) {
  // Stateless: a new server and transport per request, sharing the sources (and their cache)
  const http = createHttpServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (path !== '/mcp') {
      res.writeHead(404).end('Not found. The MCP endpoint is /mcp.')
      return
    }
    if (req.method !== 'POST') {
      // Stateless mode has no server-initiated stream to GET, and no session to DELETE
      res.writeHead(405, { Allow: 'POST' }).end()
      return
    }
    try {
      const server = createServer(sources)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, await readJson(req))
    } catch (error) {
      log('request failed:', error)
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Bad request' }, id: null }))
      }
    }
  })
  http.listen(port, () => log(`listening on http://localhost:${port}/mcp`))
}

async function main() {
  if (process.argv.includes('--http')) {
    await serveHttp(Number(process.env.PORT || 3000))
    return
  }
  await createServer(sources).connect(new StdioServerTransport())
  log(`ready on stdio (experience: ${config.experiencePath})`)
}

main().catch((error) => {
  log(error)
  process.exit(1)
})
