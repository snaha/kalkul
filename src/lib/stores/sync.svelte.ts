import { createKalkulMcpServer } from '$lib/mcp/server'
import { type SyncStatus, WsTransport } from '$lib/mcp/ws-transport'
import storageKeys from '$lib/storage-keys'

/**
 * Owns the connection to the optional local relay (server/index.ts) that
 * exposes the in-browser MCP server to AI agents. Empty URL means off.
 */
function withSyncStore() {
  let url = $state('')
  let status = $state<SyncStatus>('disconnected')
  let transport: WsTransport | undefined

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

    /** Reads the stored URL and connects. Returns the cleanup. */
    init(): () => void {
      url = localStorage.getItem(storageKeys.SYNC_URL) ?? ''
      connect()
      return () => {
        void transport?.close()
        transport = undefined
      }
    },

    setUrl(next: string): void {
      url = next
      if (next) localStorage.setItem(storageKeys.SYNC_URL, next)
      else localStorage.removeItem(storageKeys.SYNC_URL)
      connect()
    },
  }
}

export const syncStore = withSyncStore()
