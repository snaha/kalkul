import {
  type Portfolio,
  type Profile,
  type StoredData,
  profileSchema,
  repairStoredCashFlowMonths,
  storedDataSchema,
} from '$lib/schemas'
import storageKeys from '$lib/storage-keys'
import {
  DEFAULT_CURRENCY,
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyCode,
  formatNumber,
  getFormattingLocale,
  parseDateOnly,
} from '$lib/utils'

import type { PortfolioStore } from './portfolio.svelte'
import { withPortfolioStore } from './portfolio.svelte'
import { storageErrorStore } from './storage-error.svelte'

export type ProfileStore = Profile & {
  readonly birthDate: Date | undefined
  readonly currencyOrDefault: string
  toJSON: () => Profile
}

function enrichProfile({
  name,
  email,
  birth_date,
  location,
  currency,
  cash_amount,
  has_investments,
  has_tangible_assets,
  has_liabilities,
  investments,
  tangible_assets,
  liabilities,
  incomes,
  expenses,
  hide_plan_intro,
}: Profile): ProfileStore {
  return {
    name,
    email,
    birth_date,
    location,
    currency,
    cash_amount,
    has_investments,
    has_tangible_assets,
    has_liabilities,
    investments,
    tangible_assets,
    liabilities,
    incomes,
    expenses,
    hide_plan_intro,
    get birthDate() {
      return birth_date ? parseDateOnly(birth_date) : undefined
    },
    get currencyOrDefault() {
      return currency ?? DEFAULT_CURRENCY
    },
    toJSON(): Profile {
      return {
        name,
        email,
        birth_date,
        location,
        currency,
        cash_amount,
        has_investments,
        has_tangible_assets,
        has_liabilities,
        investments,
        tangible_assets,
        liabilities,
        incomes,
        expenses,
        hide_plan_intro,
      }
    },
  }
}

const DEFAULT_PROFILE: Profile = {
  name: '',
  email: '',
}

function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(storageKeys.DATA)
    if (raw) {
      // Repair before parsing: data stored before stricter validation rules
      // must keep loading, otherwise the whole dataset falls back to the
      // empty default and gets overwritten on the next persist.
      return storedDataSchema.parse(repairStoredCashFlowMonths(JSON.parse(raw)))
    }
  } catch (e) {
    console.error('Failed to load data from localStorage', e)
  }
  return { lastUpdated: 0, profile: { ...DEFAULT_PROFILE }, portfolios: [] }
}

function withAppStore() {
  let browserLocale = $state<string | undefined>(undefined)
  let profile = $state<ProfileStore>(enrichProfile({ ...DEFAULT_PROFILE }))
  let portfolios = $state<PortfolioStore[]>([])
  let loading = $state(true)
  let lastUpdated = $state(0)

  function persist(): void {
    const now = Date.now()
    const stored: StoredData = {
      lastUpdated: now,
      profile: profile.toJSON(),
      portfolios: portfolios.map((p) => p.toJSON()),
    }
    // Never write data the read path would reject: loadData() enforces the
    // full schema, so an invalid write would persist fine today and brick the
    // whole dataset on the next load. updateProfile validates the profile,
    // but portfolio writes (update()/addPortfolio) have no gate of their own
    // — this is the one place that covers them all.
    const validated = storedDataSchema.safeParse(stored)
    if (!validated.success) {
      console.error('Refusing to persist data that would fail to load', validated.error)
      storageErrorStore.setError('validation')
      portfolios = [...portfolios]
      return
    }
    try {
      localStorage.setItem(storageKeys.DATA, JSON.stringify(stored))
      lastUpdated = now
      storageErrorStore.clear()
    } catch (e) {
      console.error('Failed to save data to localStorage', e)
      storageErrorStore.setError('write')
    }
    // Trigger reactivity: $state reassignment
    portfolios = [...portfolios]
  }

  function deletePortfolio(id: string): void {
    const idx = portfolios.findIndex((p) => p.id === id)
    if (idx !== -1) portfolios.splice(idx, 1)
    persist()
  }

  const appParent = {
    persist,
    deletePortfolio,
  }

  function enrichAll(rawPortfolios: Portfolio[]): PortfolioStore[] {
    return rawPortfolios.map((p) => withPortfolioStore(p, appParent))
  }

  return {
    set browserLocale(value: string | undefined) {
      browserLocale = value
    },
    get lastUpdated() {
      return lastUpdated
    },
    get profile() {
      return profile
    },
    get portfolios() {
      return portfolios
    },
    get loading() {
      return loading
    },
    clear() {
      profile = enrichProfile({ ...DEFAULT_PROFILE })
      portfolios = []
      lastUpdated = 0
      try {
        localStorage.removeItem(storageKeys.DATA)
        storageErrorStore.clear()
      } catch (e) {
        console.error('Failed to clear data from localStorage', e)
        storageErrorStore.setError()
      }
      loading = false
    },

    persist,
    deletePortfolio,

    // --- Formatting ---

    formatNumber(value: number) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return formatNumber(value, loc)
    },
    formatCurrency(value: number) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return formatCurrency(value, profile.currencyOrDefault, loc)
    },
    formatCompactCurrency(value: number) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return formatCompactCurrency(value, profile.currencyOrDefault, loc)
    },
    formatCurrencyCode(value: number) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return formatCurrencyCode(value, profile.currencyOrDefault, loc)
    },

    // --- Profile ---

    updateProfile(updates: Partial<Profile>) {
      const merged = { ...profile.toJSON(), ...updates }
      const validated = profileSchema.parse(merged)
      profile = enrichProfile(validated)
      persist()
    },

    // --- Portfolios ---

    addPortfolio(data: Omit<Portfolio, 'id'>): string {
      const portId = crypto.randomUUID()
      const newPortfolio: Portfolio = { ...data, id: portId }
      const enrichedPortf = withPortfolioStore(newPortfolio, appParent)
      portfolios.push(enrichedPortf)
      persist()
      return portId
    },

    // --- Load ---

    load(): void {
      const data = loadData()
      profile = enrichProfile(data.profile)
      portfolios = enrichAll(data.portfolios)
      lastUpdated = data.lastUpdated
      loading = false
    },

    startSync(): () => void {
      function onStorage(event: StorageEvent): void {
        if (event.key !== storageKeys.DATA || !event.newValue) return

        try {
          // Repaired like loadData so a tab still running an older app
          // version can't break sync by persisting since-invalidated data.
          const data = storedDataSchema.parse(
            repairStoredCashFlowMonths(JSON.parse(event.newValue)),
          )
          if (data.lastUpdated === lastUpdated) return

          profile = enrichProfile(data.profile)
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
      return JSON.stringify(
        { profile: profile.toJSON(), portfolios: portfolios.map((p) => p.toJSON()) },
        undefined,
        2,
      )
    },

    importBackup(json: string): void {
      // Repaired like loadData so backups exported before stricter
      // validation rules stay restorable.
      const parsed: unknown = repairStoredCashFlowMonths(JSON.parse(json))
      const validated = storedDataSchema.pick({ profile: true, portfolios: true }).parse(parsed)
      profile = enrichProfile(validated.profile)
      portfolios = enrichAll(validated.portfolios)
      loading = false
      persist()
    },
  }
}

export const appStore = withAppStore()
