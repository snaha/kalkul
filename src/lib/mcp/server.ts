import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { appStore } from '$lib/stores/app.svelte'

import { kalkulTools } from './tools'

/**
 * MCP server that runs inside the browser tab and operates directly on the
 * app store, so every write goes through the same validation and persistence
 * as the UI. The local relay (server/index.ts) only forwards JSON-RPC.
 */
export function createKalkulMcpServer(app: typeof appStore = appStore): McpServer {
  const server = new McpServer({ name: 'kalkul', version: '1.0.0' })
  for (const t of kalkulTools(app)) {
    if (t.inputSchema) {
      server.registerTool(
        t.name,
        { description: t.description, inputSchema: t.inputSchema },
        (args) => t.execute(args),
      )
    } else {
      server.registerTool(t.name, { description: t.description }, () => t.execute({}))
    }
  }
  return server
}
