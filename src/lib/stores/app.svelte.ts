import { SvelteSet } from 'svelte/reactivity'
import type { Portfolio, PortfolioNested, Profile } from '$lib/types'
import type { PortfolioStore } from './portfolio.svelte'
import { withPortfolioStore } from './portfolio.svelte'
import { storedDataSchema, type StoredData } from '$lib/schemas'
import { storageErrorStore } from './storage-error.svelte'

const STORAGE_KEY = 'kalkul-data'

const DEFAULT_PROFILE: Profile = {
  name: '',
  email: '',
  birth_date: '',
}

function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return storedDataSchema.parse(JSON.parse(raw))
    }
  } catch (e) {
    console.error('Failed to load data from localStorage', e)
  }
  return { lastUpdated: 0, profile: { ...DEFAULT_PROFILE }, portfolios: [] }
}

function withAppStore() {
  let profile = $state<Profile>({ ...DEFAULT_PROFILE })
  let portfolios = $state<PortfolioStore[]>([])
  let loading = $state(true)
  let lastUpdated = $state(0)
  const hiddenInvestmentIds = new SvelteSet<string>()

  function persist(): void {
    const now = Date.now()
    const stored: StoredData = {
      lastUpdated: now,
      profile,
      portfolios: portfolios.map((p) => p.toJSON()),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      lastUpdated = now
      storageErrorStore.clear()
    } catch (e) {
      console.error('Failed to save data to localStorage', e)
      storageErrorStore.setError()
    }
    // Trigger reactivity: $state reassignment
    portfolios = [...portfolios]
  }

  function deletePortfolio(id: string): void {
    const idx = portfolios.findIndex((p) => p.id === id)
    if (idx !== -1) portfolios.splice(idx, 1)
    persist()
  }

  function duplicatePortfolio(newPortfolio: PortfolioNested): string | undefined {
    const enrichedPortf = withPortfolioStore(newPortfolio, appParent)
    portfolios.push(enrichedPortf)
    persist()
    return newPortfolio.id
  }

  const appParent = {
    persist,
    deletePortfolio,
    duplicatePortfolio,
    hiddenIds: hiddenInvestmentIds,
  }

  function enrichAll(rawPortfolios: PortfolioNested[]): PortfolioStore[] {
    return rawPortfolios.map((p) => withPortfolioStore(p, appParent))
  }

  return {
    get lastUpdated() {
      return lastUpdated
    },
    get profile() {
      return profile
    },
    get portfolios() {
      return portfolios
    },
    set portfolios(value: PortfolioStore[]) {
      portfolios = value
      loading = false
    },
    get loading() {
      return loading
    },
    set loading(value: boolean) {
      loading = value
    },
    reset() {
      profile = { ...DEFAULT_PROFILE }
      portfolios = []
      loading = true
    },

    persist,
    deletePortfolio,
    get hiddenIds() {
      return hiddenInvestmentIds
    },

    // --- Profile ---

    updateProfile(updates: Partial<Profile>) {
      profile = { ...profile, ...updates }
      persist()
    },

    // --- Portfolios ---

    addPortfolio(data: Omit<Portfolio, 'id'>): string {
      const portId = crypto.randomUUID()
      const newPortfolio: PortfolioNested = {
        ...data,
        id: portId,
        investments: [],
        goals: [],
      }
      const enrichedPortf = withPortfolioStore(newPortfolio, appParent)
      portfolios.push(enrichedPortf)
      persist()
      return portId
    },

    // --- Load ---

    load(): void {
      const data = loadData()
      profile = data.profile
      portfolios = enrichAll(data.portfolios)
      lastUpdated = data.lastUpdated
      loading = false
    },

    startSync(): () => void {
      function onStorage(event: StorageEvent): void {
        if (event.key !== STORAGE_KEY || !event.newValue) return

        try {
          const data = storedDataSchema.parse(JSON.parse(event.newValue))
          if (data.lastUpdated === lastUpdated) return

          profile = data.profile
          portfolios = enrichAll(data.portfolios)
          lastUpdated = data.lastUpdated
        } catch {
          // Ignore malformed data from other tabs
        }
      }

      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },

    // --- Backup / Restore ---

    exportBackup(): string {
      return JSON.stringify({ profile, portfolios }, undefined, 2)
    },

    importBackup(json: string): void {
      const parsed: unknown = JSON.parse(json)
      const validated = storedDataSchema.pick({ profile: true, portfolios: true }).parse(parsed)
      profile = validated.profile
      portfolios = enrichAll(validated.portfolios)
      loading = false
      persist()
    },
  }
}

export const appStore = withAppStore()
