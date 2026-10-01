import { EVENTS, track } from '$lib/analytics'
import {
  type ExplicitBalances,
  getCurrentProfile,
  withBalancesCarriedForward,
} from '$lib/current-values'
import { hasAnyFinancialData } from '$lib/financial-totals'
import type { PlanOwned } from '$lib/plan-owned'
import {
  type Portfolio,
  type Profile,
  type StoredData,
  profileSchema,
  repairStoredData,
  storedDataSchema,
} from '$lib/schemas'
import type { Snapshot } from '$lib/schemas'
import {
  captureSnapshot,
  hasAnyBalance,
  hasSameBalances,
  heldBalances,
  latestSnapshot,
  upsertSnapshot,
  withDeletedSnapshot,
  withLatestTermsRecorded,
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
  language,
  terms_accepted,
  cash_amount,
  has_investments,
  has_tangible_assets,
  has_liabilities,
  investments,
  tangible_assets,
  liabilities,
  incomes,
  expenses,
  transfers,
  investment_tax_rules,
  tangible_asset_tax_rules,
  snapshots,
}: Profile): ProfileStore {
  return {
    name,
    email,
    birth_date,
    location,
    currency,
    language,
    terms_accepted,
    cash_amount,
    has_investments,
    has_tangible_assets,
    has_liabilities,
    investments,
    tangible_assets,
    liabilities,
    incomes,
    expenses,
    transfers,
    investment_tax_rules,
    tangible_asset_tax_rules,
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
        language,
        terms_accepted,
        cash_amount,
        has_investments,
        has_tangible_assets,
        has_liabilities,
        investments,
        tangible_assets,
        liabilities,
        incomes,
        expenses,
        transfers,
        investment_tax_rules,
        tangible_asset_tax_rules,
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
 * Edits that leave every balance alone (a rename, a new expense, a raise)
 * record nothing, keeping the History chart to points that actually moved and
 * leaving the staleness banner up until the user confirms it away.
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
  return !hasSameBalances(latestSnapshot(profile.snapshots), captureSnapshot(profile, todayDate))
}

const DEFAULT_PROFILE: Profile = {
  name: '',
  email: '',
}

/**
 * Data found in storage that this version of the app cannot read: not JSON,
 * or not a shape the schema accepts (damaged, or saved by an incompatible
 * version). The app opens empty instead, so the next save would overwrite it.
 */
interface UnreadableData {
  /** The stored text exactly as found. */
  raw: string
  /**
   * Whether a copy of `raw` is safe elsewhere: set aside under its own key, or
   * downloaded by the user. Until it is, saves are held back — the next one
   * would destroy the only copy.
   */
  kept: boolean
}

function emptyData(): StoredData {
  return { lastUpdated: 0, profile: { ...DEFAULT_PROFILE }, portfolios: [] }
}

/** `raw` as stored data, or undefined when it is not JSON the schema accepts. */
function readStoredData(raw: string): StoredData | undefined {
  try {
    // Repair before parsing: data stored before stricter validation rules —
    // or before a snapshot recorded everything it records now — must keep
    // loading rather than be set aside as unreadable.
    const result = storedDataSchema.safeParse(repairStoredData(JSON.parse(raw)))
    if (result.success) return result.data
    console.error('Stored data does not match the schema', result.error)
  } catch (e) {
    console.error('Failed to read stored data', e)
  }
  return undefined
}

/**
 * Sets aside a copy of stored data the app cannot read, under its own key, so
 * no later save can destroy it. Data already set aside is not copied again, so
 * reloading over the same unreadable data does not pile up copies, and a copy
 * of other data is never overwritten. Returns whether a copy is kept — false
 * when storage has no room for one.
 */
function keepUnreadableCopy(raw: string): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key?.startsWith(storageKeys.UNREADABLE_DATA_PREFIX) &&
        localStorage.getItem(key) === raw
      ) {
        return true
      }
    }
    localStorage.setItem(`${storageKeys.UNREADABLE_DATA_PREFIX}${new Date().toISOString()}`, raw)
    return true
  } catch (e) {
    console.error('Failed to keep a copy of the unreadable data', e)
    return false
  }
}

/**
 * The stored data, or the empty default — with the stored text as
 * `unreadable` when there was some the app cannot read.
 */
function loadData(): { data: StoredData; unreadable?: string } {
  let raw: string | undefined
  try {
    raw = localStorage.getItem(storageKeys.DATA) ?? undefined
  } catch (e) {
    console.error('Failed to load data from localStorage', e)
  }
  if (!raw) return { data: emptyData() }
  const data = readStoredData(raw)
  return data ? { data } : { data: emptyData(), unreadable: raw }
}

function withAppStore() {
  let browserLocale = $state<string | undefined>(undefined)
  let profile = $state<ProfileStore>(enrichProfile({ ...DEFAULT_PROFILE }))
  let portfolios = $state<PortfolioStore[]>([])
  let loading = $state(true)
  let lastUpdated = $state(0)
  let unreadableData = $state<UnreadableData | undefined>(undefined)

  function setAside(raw: string): void {
    unreadableData = { raw, kept: keepUnreadableCopy(raw) }
  }

  function persist(): void {
    // Storage still holds data that could not be read and has no copy
    // anywhere else: this write would destroy it. Changes stay in memory
    // until the user downloads it.
    if (unreadableData?.kept === false) {
      portfolios = [...portfolios]
      return
    }
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
   * The balances a confirmation states outright: everything Quick update's
   * dialog puts in front of the user. They are persisted exactly as submitted,
   * including a value typed back to the stored figure — that is a correction,
   * not an untouched field. Everything the payload leaves out (loans, asset
   * values) is carried forward by the clock read here rather than the page's.
   */
  function explicitBalancesOf(updates: Partial<Profile>): ExplicitBalances {
    return {
      cash: updates.cash_amount !== undefined,
      investmentIds: new Set((updates.investments ?? []).map((i) => i.id)),
    }
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
      recording
        ? withBalancesCarriedForward(
            stored,
            next,
            today,
            history === 'confirm' ? explicitBalancesOf(updates) : undefined,
          )
        : next,
    )

    profile = enrichProfile(
      recording
        ? {
            ...validated,
            snapshots: upsertSnapshot(validated.snapshots, captureSnapshot(validated, todayDate)),
          }
        : // Nothing recorded, but a loan term may still have changed — it moves
          // no balance — and the newest snapshot has to state it, or the next
          // History-page save would re-baseline the old one back.
          withLatestTermsRecorded(validated),
    )
    persist()

    // The two funnel steps a profile write can complete: onboarding naming the
    // profile, and the first balances or cash flows going in.
    if (!stored.name && validated.name) track(EVENTS.PROFILE_CREATED)
    if (!hasAnyFinancialData(stored) && hasAnyFinancialData(validated)) {
      track(EVENTS.FINANCES_SAVED)
    }
  }

  function deletePortfolio(id: string): void {
    const idx = portfolios.findIndex((p) => p.id === id)
    if (idx !== -1) portfolios.splice(idx, 1)
    // Everything created in the plan goes with it; nothing else can show it.
    const stored = profile.toJSON()
    const ownsNothing = !(
      [
        stored.investments,
        stored.tangible_assets,
        stored.liabilities,
        stored.incomes,
        stored.expenses,
        stored.transfers,
      ] as (PlanOwned[] | undefined)[]
    ).some((items) => items?.some((item) => item.plan_id === id))
    if (ownsNothing) {
      persist()
      return
    }
    const disown = <T extends PlanOwned>(items: T[] | undefined) =>
      items?.filter((item) => item.plan_id !== id)
    profile = enrichProfile(
      profileSchema.parse({
        ...stored,
        investments: disown(stored.investments),
        tangible_assets: disown(stored.tangible_assets),
        liabilities: disown(stored.liabilities),
        incomes: disown(stored.incomes),
        expenses: disown(stored.expenses),
        transfers: disown(stored.transfers),
      }),
    )
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
    /** Whether the user has set up a profile, as opposed to an empty app. */
    get hasData() {
      return !loading && !!profile.name
    },
    /** Stored data the app could not read and opened empty instead of. */
    get unreadableData(): UnreadableData | undefined {
      return unreadableData
    },
    /**
     * The user downloaded the unreadable data, so a copy now exists outside
     * the browser and saves may overwrite the original.
     */
    markUnreadableDataDownloaded(): void {
      if (unreadableData) unreadableData = { ...unreadableData, kept: true }
    },
    clear() {
      profile = enrichProfile({ ...DEFAULT_PROFILE })
      portfolios = []
      lastUpdated = 0
      unreadableData = undefined
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
      track(EVENTS.BALANCES_CONFIRMED)
    },

    // --- History ---

    /**
     * Adds or replaces a snapshot from the History page. Pass `originalDate`
     * when editing one whose date the user changed, so the entry does not
     * survive at both dates.
     */
    saveSnapshot(snapshot: Snapshot, originalDate?: string) {
      // A snapshot dated after the baseline moves the baseline forward, so the
      // profile is carried to that date first — the way the dashboard and
      // Quick update reach it. A planned sale in between otherwise reaches cash
      // through the snapshot's figures while the sold position keeps its
      // balance, and the plan sells it a second time. Carried to a date that
      // is not later, nothing has elapsed and the profile is unchanged.
      const carried = getCurrentProfile(profile.toJSON(), parseDateOnly(snapshot.date))
      writeProfile(withSavedSnapshot(carried, snapshot, originalDate), 'manage')
    },

    /**
     * Deletes the snapshot dated `date`.
     *
     * Deleting the last one would leave the profile holding balances with no
     * baseline to project them from: no staleness banner, no projection, and
     * the next unrelated edit stamping today's date onto months-old figures.
     * So the deleted snapshot's figures are carried forward to today — the same
     * model the dashboard shows them with — and recorded there. History is
     * never empty while there are balances, and the user sees exactly what
     * happened as a row dated today, theirs to edit or delete in turn.
     */
    deleteSnapshot(date: string) {
      const today = new Date()
      const stored = profile.toJSON()
      const deleted = (stored.snapshots ?? []).find((snapshot) => snapshot.date === date)
      const next = withDeletedSnapshot(stored, date)
      // Gated on what is held today, not on whether the profile has any data:
      // a position that only starts in 2030 is nothing to project from, and
      // recording an all-zero row for today would say otherwise.
      if (
        !deleted ||
        (next.snapshots ?? []).length > 0 ||
        !hasAnyBalance(heldBalances(next, today))
      ) {
        writeProfile(next, 'manage')
        return
      }
      // The profile already holds the deleted snapshot's figures — it was the
      // newest, and every write keeps the profile matching that one — so it is
      // the baseline to project from.
      const carried = getCurrentProfile({ ...next, snapshots: [deleted] }, today)
      writeProfile(
        { ...carried, snapshots: [captureSnapshot(carried, toDateOnlyString(today))] },
        'manage',
      )
    },

    // --- Portfolios ---

    addPortfolio(data: Omit<Portfolio, 'id'>): string {
      const portId = crypto.randomUUID()
      const newPortfolio: Portfolio = { ...data, id: portId }
      const enrichedPortf = withPortfolioStore(newPortfolio, appParent)
      portfolios.push(enrichedPortf)
      persist()
      track(EVENTS.PLAN_CREATED)
      if (portfolios.length === 1) track(EVENTS.FIRST_PLAN_CREATED)
      return portId
    },

    // --- Load ---

    load(): void {
      const { data, unreadable } = loadData()
      if (unreadable === undefined) unreadableData = undefined
      else setAside(unreadable)
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
          const data = storedDataSchema.parse(repairStoredData(JSON.parse(event.newValue)))
          if (data.lastUpdated === lastUpdated) return

          profile = enrichProfile(data.profile)
          portfolios = enrichAll(data.portfolios)
          lastUpdated = data.lastUpdated
        } catch {
          // Another tab saved data this tab cannot read (it runs a different
          // app version, say). This tab stays as it is, but sets the data
          // aside the way `load` does: its next save would overwrite it.
          setAside(event.newValue)
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
      const parsed: unknown = repairStoredData(JSON.parse(json))
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
