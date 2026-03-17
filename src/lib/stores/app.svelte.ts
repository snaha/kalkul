import { SvelteSet } from 'svelte/reactivity'
import type { ClientNested, ClientNoId, ClientStore } from '$lib/types'
import { clientNestedSchema, storedDataSchema, type StoredData } from '$lib/schemas'
import { withClientStore } from './client.svelte'
import { storageErrorStore } from './storage-error.svelte'

const STORAGE_KEY = 'kalkul-data'

function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return storedDataSchema.parse(JSON.parse(raw))
    }
  } catch (e) {
    console.error('Failed to load data from localStorage', e)
  }
  return { lastUpdated: 0, clients: [] }
}

function withAppStore() {
  let clients = $state.raw<ClientStore[]>([])
  let loading = $state(true)
  let lastUpdated = $state(0)
  const hiddenInvestmentIds = new SvelteSet<string>()

  function persist(): void {
    lastUpdated = Date.now()
    const stored: StoredData = { lastUpdated, clients }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      storageErrorStore.clear()
    } catch {
      storageErrorStore.set()
    }
    // Trigger reactivity: $state.raw only signals on reassignment, so create
    // a new array reference after every mutation.
    clients = [...clients]
  }

  function deleteClient(id: string): void {
    const idx = clients.findIndex((c) => c.id === id)
    if (idx === -1) return
    clients.splice(idx, 1)
    persist()
  }

  const appParent = {
    persist,
    deleteClient,
    hiddenIds: hiddenInvestmentIds,
  }

  function enrichAll(rawClients: ClientNested[]): ClientStore[] {
    return rawClients.map((c) => withClientStore(c, appParent))
  }

  return {
    get lastUpdated() {
      return lastUpdated
    },
    get clients() {
      return clients
    },
    set clients(value: ClientStore[]) {
      clients = value
      loading = false
    },
    get loading() {
      return loading
    },
    set loading(value: boolean) {
      loading = value
    },
    reset() {
      clients = []
      loading = true
    },

    persist,
    deleteClient,
    get hiddenIds() {
      return hiddenInvestmentIds
    },

    // --- Load ---

    load(): void {
      const data = loadData()
      clients = enrichAll(data.clients)
      lastUpdated = data.lastUpdated
      loading = false
    },

    startSync(): () => void {
      function onStorage(event: StorageEvent): void {
        if (event.key !== STORAGE_KEY || !event.newValue) return

        try {
          const data = storedDataSchema.parse(JSON.parse(event.newValue))
          if (data.lastUpdated === lastUpdated) return

          clients = enrichAll(data.clients)
          lastUpdated = data.lastUpdated
        } catch {
          // Ignore malformed data from other tabs
        }
      }

      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },

    // --- Finders ---

    findClient(id: string): ClientStore | undefined {
      return clients.find((c) => c.id === id)
    },

    // --- Clients ---

    addClient(client: ClientNoId): string {
      const id = crypto.randomUUID()
      const newClient: ClientNested = {
        ...client,
        id,
        portfolios: [],
      }
      const enrichedClient = withClientStore(newClient, appParent)
      clients.push(enrichedClient)
      persist()
      return id
    },

    // --- Backup / Restore ---

    exportBackup(): string {
      return JSON.stringify(clients, undefined, 2)
    },

    importBackup(json: string): void {
      const parsed: unknown = JSON.parse(json)
      const validated = clientNestedSchema.array().parse(parsed)
      clients = enrichAll(validated)
      loading = false
      persist()
    },
  }
}

export const appStore = withAppStore()
