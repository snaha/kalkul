import { withBalancesCarriedForward } from '$lib/current-values'
import { hasAnyFinancialData } from '$lib/financial-totals'
import {
  type Portfolio,
  type Profile,
  type StoredData,
  profileSchema,
  repairStoredCashFlowMonths,
  storedDataSchema,
} from '$lib/schemas'
import type { Snapshot } from '$lib/schemas'
import {
  captureSnapshot,
  hasSameValues,
  latestSnapshot,
  upsertSnapshot,
  withDeletedSnapshot,
  withSavedSnapshot,
  withSeededSnapshot,
} from '$lib/snapshots'
import storageKeys from '$lib/storage-keys'
import {
  DEFAULT_CURRENCY,
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyCode,
  formatLastUpdated,
  formatNumber,
  formatPercent,
  getFormattingLocale,
  parseDateOnly,
  toDateOnlyString,
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
  snapshots,
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
    snapshots,
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
        snapshots,
      }
    },
  }
}

/**
 * Whether saving `profile` should record its balances as today's snapshot.
 *
 * Snapshots are the baseline the dashboard projects "today" from, so every
 * confirmed change to a balance has to re-date that baseline — otherwise the
 * projection keeps compounding from a value the user has already replaced.
 * Edits that leave every balance alone (a rename, a new expense) record
 * nothing, keeping the History chart to points that actually moved.
 *
 * `force` overrides that skip for an explicit confirmation ("these balances are
 * correct today", i.e. Quick update's Confirm): the point of the action is the
 * new date, so it has to record even when every balance matches — otherwise a
 * profile whose values legitimately did not move can never clear the staleness
 * banner.
 */
function shouldRecordSnapshot(profile: Profile, todayDate: string, force: boolean): boolean {
  // Nothing to record for a profile that has never held a balance — that gate
  // is there to keep all-zero snapshots out of an empty profile's history. Once
  // a baseline exists, though, going to zero is a real move (the user spent
  // their cash and owns nothing else) and has to be recorded like any other.
  if (!hasAnyFinancialData(profile) && (profile.snapshots ?? []).length === 0) return false
  if (force) return true
  return !hasSameValues(latestSnapshot(profile.snapshots), captureSnapshot(profile, todayDate))
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
    try {
      localStorage.setItem(storageKeys.DATA, JSON.stringify(stored))
      lastUpdated = now
      storageErrorStore.clear()
    } catch (e) {
      console.error('Failed to save data to localStorage', e)
      storageErrorStore.setError()
    }
    // Trigger reactivity: $state reassignment
    portfolios = [...portfolios]
  }

  /**
   * How a write treats history. 'auto' records today's figures when they moved,
   * 'confirm' always records them, and 'manage' leaves history exactly as the
   * caller supplied it — the History page settles the snapshot list itself, and
   * an automatic entry for today would fight every edit it makes.
   */
  type HistoryMode = 'auto' | 'confirm' | 'manage'

  function writeProfile(updates: Partial<Profile>, history: HistoryMode): void {
    const today = new Date()
    const todayDate = toDateOnlyString(today)
    const stored = profile.toJSON()
    const next = { ...stored, ...updates }

    // The History page hands over a profile whose snapshots it has already
    // settled, balances re-baselined and all. Nothing to record, and nothing to
    // carry forward — the figures it supplies are the ones to keep.
    if (history === 'manage') {
      profile = enrichProfile(profileSchema.parse(next))
      persist()
      return
    }

    // Asked against the stored balances, which the latest snapshot matches by
    // construction — so the only differences it can see are the ones `updates`
    // introduces.
    const recording = shouldRecordSnapshot(next, todayDate, history === 'confirm')

    // Recording re-dates the baseline the dashboard projects from, so balances
    // the edit left alone have to reach today before that happens. An edit that
    // records nothing keeps the old baseline, and so has to keep the stored
    // balances matching it.
    const validated = profileSchema.parse(
      recording ? withBalancesCarriedForward(stored, next, today) : next,
    )

    profile = enrichProfile(
      recording
        ? {
            ...validated,
            snapshots: upsertSnapshot(validated.snapshots, captureSnapshot(validated, todayDate)),
          }
        : validated,
    )
    persist()
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
    // Dates shown next to formatted numbers resolve the same formatting
    // locale (profile location → browser), NOT the svelte-i18n UI language —
    // otherwise a Czech user with an English UI sees '1 234 567 Kč' next to
    // '7/7/2026' on one screen.
    formatDate(ms: number) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return new Date(ms).toLocaleDateString(loc)
    },
    /** Same, for a date-only ISO string (`YYYY-MM-DD`) such as a snapshot date. */
    formatDateOnly(dateOnly: string) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return parseDateOnly(dateOnly).toLocaleDateString(loc)
    },
    formatPercent(value: number, digits = 1, signed = false) {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return formatPercent(value, digits, loc, signed)
    },
    /** Formatted lastUpdated date, or undefined when nothing was saved yet. */
    formatLastUpdated(): string | undefined {
      const loc = getFormattingLocale(profile.location, browserLocale)
      return formatLastUpdated(lastUpdated, loc)
    },

    // --- Profile ---

    updateProfile(updates: Partial<Profile>) {
      writeProfile(updates, 'auto')
    },

    /**
     * Same as `updateProfile`, but for an explicit "these are my balances as of
     * today" confirmation (Quick update's Confirm). Always stamps a snapshot
     * dated today, even when the confirmed values equal the stored ones — the
     * date is the whole point of the action.
     */
    confirmBalances(updates: Partial<Profile>) {
      writeProfile(updates, 'confirm')
    },

    // --- History ---

    /**
     * Adds or replaces a snapshot from the History page. Pass `originalDate`
     * when editing one whose date the user changed, so the entry does not
     * survive at both dates.
     */
    saveSnapshot(snapshot: Snapshot, originalDate?: string) {
      writeProfile(withSavedSnapshot(profile.toJSON(), snapshot, originalDate), 'manage')
    },

    deleteSnapshot(date: string) {
      writeProfile(withDeletedSnapshot(profile.toJSON(), date), 'manage')
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
      // Data saved before snapshots existed gets its baseline from the last
      // write. Derived on every load rather than written back, so opening the
      // app never mutates stored data on its own.
      profile = enrichProfile(
        data.lastUpdated > 0
          ? withSeededSnapshot(data.profile, new Date(data.lastUpdated))
          : data.profile,
      )
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
      // A backup taken before snapshots existed carries no history; treat the
      // restored balances as confirmed now rather than as indefinitely stale.
      profile = enrichProfile(withSeededSnapshot(validated.profile, new Date()))
      portfolios = enrichAll(validated.portfolios)
      loading = false
      persist()
    },
  }
}

export const appStore = withAppStore()
