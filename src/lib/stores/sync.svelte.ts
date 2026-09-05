import { createKalkulMcpServer } from '$lib/mcp/server'
import { getModelContext, registerWebMcpTools } from '$lib/mcp/web-mcp'
import { type SyncStatus, WsTransport } from '$lib/mcp/ws-transport'
import storageKeys from '$lib/storage-keys'

/**
 * Owns the connection to the optional local relay (server/index.ts) that
 * exposes the in-browser MCP server to AI agents. Empty URL means off.
 * Also owns the WebMCP opt-in: the same tools registered directly with the
 * browser (document.modelContext) for agents that run inside it.
 */
function withSyncStore() {
  let url = $state('')
  let status = $state<SyncStatus>('disconnected')
  let transport: WsTransport | undefined
  let webMcp = $state(false)
  let unregisterWebMcp: (() => void) | undefined

  function applyWebMcp(): void {
    unregisterWebMcp?.()
    unregisterWebMcp = undefined
    const ctx = getModelContext()
    if (webMcp && ctx) unregisterWebMcp = registerWebMcpTools(ctx)
  }

  function connect(): void {
    void transport?.close()
    transport = undefined
    status = 'disconnected'
    if (!url) return
    transport = new WsTransport(url, (s) => (status = s))
    createKalkulMcpServer().connect(transport).catch(console.error)
  }

  return {
    get url() {
      return url
    },
    get status() {
      return status
    },
    get webMcp() {
      return webMcp
    },
    get webMcpSupported() {
      return getModelContext() !== undefined
    },

    /** Reads the stored URL and connects. Returns the cleanup. */
    init(): () => void {
      url = localStorage.getItem(storageKeys.SYNC_URL) ?? ''
      connect()
      webMcp = localStorage.getItem(storageKeys.WEB_MCP) === 'true'
      applyWebMcp()
      return () => {
        void transport?.close()
        transport = undefined
        unregisterWebMcp?.()
        unregisterWebMcp = undefined
      }
    },

    setUrl(next: string): void {
      url = next
      if (next) localStorage.setItem(storageKeys.SYNC_URL, next)
      else localStorage.removeItem(storageKeys.SYNC_URL)
      connect()
    },

    setWebMcp(on: boolean): void {
      webMcp = on
      if (on) localStorage.setItem(storageKeys.WEB_MCP, 'true')
      else localStorage.removeItem(storageKeys.WEB_MCP)
      applyWebMcp()
    },
  }
}

export const syncStore = withSyncStore()
