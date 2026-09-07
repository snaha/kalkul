/**
 * Local relay between an MCP client (e.g. Claude Code over Streamable HTTP)
 * and the Kalkul browser tab, which runs the actual MCP server
 * (src/lib/mcp/server.ts) over a WebSocket. This process holds no data and
 * knows nothing about the tools: it forwards JSON-RPC requests to the tab and
 * routes the responses back by id.
 *
 *   pnpm server
 *   claude mcp add --transport http kalkul http://127.0.0.1:3001/mcp
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { JSONRPCMessageSchema, type RequestId } from '@modelcontextprotocol/sdk/types.js'
import { createServer } from 'node:http'
import { type WebSocket, WebSocketServer } from 'ws'

import { REPLACED_CLOSE_CODE } from '../src/lib/mcp/ws-transport'
import { isAllowedOrigin } from './origin'

const port = Number(process.env.PORT ?? 3001)
const NO_BROWSER =
  'No browser connected: open Kalkul and connect this relay under Settings → MCP server'

// ponytail: last tab wins, no multi-tab arbitration
let browser: WebSocket | undefined

// Keyed by a relay-assigned id, not the client's JSON-RPC id: two MCP clients
// (two Claude Code sessions, say) both start numbering at 1, so the client id
// alone would collide and route a reply to the wrong transport. We rewrite the
// id on the way to the tab and restore the client's own id on the way back.
const pending = new Map<number, { transport: StreamableHTTPServerTransport; id: RequestId }>()
let nextRelayId = 0

function fail(id: RequestId, transport: StreamableHTTPServerTransport): void {
  void transport.send({ jsonrpc: '2.0', id, error: { code: -32000, message: NO_BROWSER } })
}

const http = createServer(async (req, res) => {
  if (req.url !== '/mcp' || req.method !== 'POST') {
    res.writeHead(404).end()
    return
  }
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    // A DNS-rebinding page whose hostname resolves to 127.0.0.1 could otherwise
    // POST to the relay with no CORS in the way; the WebSocket already checks
    // Origin, so close the same hole on the HTTP side.
    enableDnsRebindingProtection: true,
    allowedHosts: [`127.0.0.1:${port}`, `localhost:${port}`],
  })
  transport.onmessage = (message) => {
    const id = 'id' in message && 'method' in message ? message.id : undefined
    if (!browser) {
      if (id !== undefined) fail(id, transport)
      return
    }
    if (id === undefined) {
      // A notification has no reply to route, so forward it untouched.
      browser.send(JSON.stringify(message))
      return
    }
    const relayId = nextRelayId++
    pending.set(relayId, { transport, id })
    browser.send(JSON.stringify({ ...message, id: relayId }))
  }
  await transport.handleRequest(req, res)
})

new WebSocketServer({
  server: http,
  path: '/ws',
  verifyClient: ({ origin }: { origin: string }) =>
    isAllowedOrigin(origin, process.env.KALKUL_ORIGINS),
}).on('connection', (socket) => {
  browser?.close(REPLACED_CLOSE_CODE, 'replaced by another tab')
  browser = socket
  socket.on('message', (raw) => {
    let message
    try {
      message = JSONRPCMessageSchema.parse(JSON.parse(raw.toString()))
    } catch (error) {
      // One bad frame must not take down the relay for every client.
      console.error('Kalkul relay: dropping malformed frame from the tab', error)
      return
    }
    if (!('id' in message) || 'method' in message || message.id === undefined) return
    const entry = pending.get(message.id as number)
    if (!entry) return
    pending.delete(message.id as number)
    void entry.transport.send({ ...message, id: entry.id })
  })
  socket.on('close', () => {
    if (browser === socket) browser = undefined
    for (const { transport, id } of pending.values()) fail(id, transport)
    pending.clear()
  })
})

http.listen(port, '127.0.0.1', () => {
  console.log(`Kalkul relay: MCP at http://127.0.0.1:${port}/mcp, app at ws://127.0.0.1:${port}/ws`)
})
