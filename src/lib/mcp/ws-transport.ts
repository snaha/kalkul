import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { type JSONRPCMessage, JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js'

export type SyncStatus = 'connected' | 'disconnected'

/**
 * MCP transport over a browser WebSocket to the local relay
 * (server/index.ts). Reconnects on its own; the MCP server on top keeps
 * running across reconnects because the relay is stateless.
 */
export class WsTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private socket: WebSocket | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private closed = false

  constructor(
    private readonly url: string,
    private readonly onStatus: (status: SyncStatus) => void,
    private readonly reconnectMs = 3000,
  ) {}

  async start(): Promise<void> {
    this.connect()
  }

  private connect(): void {
    const socket = new WebSocket(this.url)
    this.socket = socket
    socket.onopen = () => this.onStatus('connected')
    socket.onmessage = (event) => {
      try {
        this.onmessage?.(JSONRPCMessageSchema.parse(JSON.parse(String(event.data))))
      } catch (e) {
        this.onerror?.(e instanceof Error ? e : new Error(String(e)))
      }
    }
    socket.onclose = () => {
      this.onStatus('disconnected')
      // ponytail: fixed 3s retry, add backoff if it ever matters
      if (!this.closed) this.timer = setTimeout(() => this.connect(), this.reconnectMs)
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Not connected')
    this.socket.send(JSON.stringify(message))
  }

  async close(): Promise<void> {
    this.closed = true
    clearTimeout(this.timer)
    this.socket?.close()
    this.onclose?.()
  }
}
