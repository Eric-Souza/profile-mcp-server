// Launch the built server over stdio like a client would, list its tools, and read the resume.
//   npm run build && node scripts/smoke.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'

const server = fileURLToPath(new URL('../dist/index.js', import.meta.url))

const transport = new StdioClientTransport({ command: 'node', args: [server], stderr: 'inherit' })
const client = new Client({ name: 'smoke', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log('tools:', tools.map((t) => t.name).join(', '))
const { resources } = await client.listResources()
console.log('resources:', resources.map((r) => r.uri).join(', '))
const { contents } = await client.readResource({ uri: 'profile://resume' })
console.log(contents[0].text)
const experience = await client.callTool({ name: 'get_experience', arguments: { skill: 'RAG' } })
console.log('get_experience(skill=RAG):', experience.structuredContent.roles.length, 'role(s)')
await client.close()
