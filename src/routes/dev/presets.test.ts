import { describe, expect, test } from 'vitest'

import { daysBetween } from '$lib/@snaha/kalkul-maths'
import { getCurrentProfile } from '$lib/current-values'
import { getNetWorth, hasAnyFinancialData } from '$lib/financial-totals'
import { storedDataSchema } from '$lib/schemas'
import { captureSnapshot, latestSnapshot, snapshotNetWorth } from '$lib/snapshots'
import { toDateOnlyString } from '$lib/utils'

import { getDevPresets } from './presets'

const TODAY = new Date(2026, 7, 12) // 2026-08-12
const presets = getDevPresets(TODAY)

// Every country the profile picker offers. A preset carrying anything else
// (a translation key, say) would silently fall back to the browser locale for
// number formatting instead of the country's — the exact bug this guards.
const VALID_LOCATIONS = new Set(['CZ', 'SK', 'HU', 'FR', 'other'])

/** Days covered by a snapshot list. */
const span = (snapshots: { date: string }[]): number =>
  snapshots.length > 1 ? daysBetween(snapshots[0].date, snapshots[snapshots.length - 1].date) : 0

describe('dev presets', () => {
  test('every preset is loadable data', () => {
    for (const preset of presets) {
      // Mirrors what importBackup() does when the preset is applied.
      expect(() =>
        storedDataSchema.pick({ profile: true, portfolios: true }).parse(preset.data),
      ).not.toThrow()
    }
  })

  test('every location is a country the profile picker offers', () => {
    for (const preset of presets) {
      const { location } = preset.data.profile
      if (location !== undefined) expect(VALID_LOCATIONS).toContain(location)
    }
  })

  test('ships a pre-snapshot profile so the migration can be exercised by hand', () => {
    // Data written before snapshots existed: balances but no history, restored
    // to storage with the date it was last written. Loading it is the only way
    // to see `withSeededSnapshot` derive a stale baseline from `lastUpdated` —
    // going through importBackup would stamp the baseline as today instead.
    const legacy = presets.filter((preset) => preset.storedAsOf !== undefined)
    expect(legacy.length).toBeGreaterThan(0)

    for (const preset of legacy) {
      expect(preset.data.profile.snapshots).toBeUndefined()
      expect(hasAnyFinancialData(preset.data.profile)).toBe(true)
      expect(preset.storedAsOf?.getTime()).toBeLessThan(TODAY.getTime())
    }
  })

  test("leaves today's snapshot to be added by hand, bar the one fresh fixture", () => {
    // Quick update is only reachable while the balances are stale, so a preset
    // whose history already ends today cannot exercise recording a snapshot.
    // Exactly one preset keeps that state, to show the confirmed-today look.
    const endsToday = presets.filter(
      (preset) => latestSnapshot(preset.data.profile.snapshots)?.date === toDateOnlyString(TODAY),
    )
    expect(endsToday.map((preset) => preset.name)).toEqual(['Martin, 30 — updated today'])
  })

  test('covers a profile with years of history behind it', () => {
    // Long histories are their own case: the X axis has to thin month ticks
    // down to years, and the chart crosses several year boundaries.
    const spans = presets.map((preset) => {
      const dates = (preset.data.profile.snapshots ?? []).map((snapshot) => snapshot.date)
      return dates.length > 0 ? daysBetween(dates[0], dates[dates.length - 1]) / 365.25 : 0
    })
    expect(Math.max(...spans)).toBeGreaterThanOrEqual(3)
  })

  test('recorded history grows at the rate the projection continues at', () => {
    // The dashboard draws a projected tail off the last snapshot. History
    // fabricated at some other rate would kink at the join — growth appearing
    // to change pace on the day the last snapshot happens to fall.
    for (const preset of presets) {
      const profile = preset.data.profile
      const snapshots = profile.snapshots ?? []
      const current = getNetWorth(profile)
      if (snapshots.length < 2 || current <= 0) continue

      const years = daysBetween(snapshots[0].date, snapshots[snapshots.length - 1].date) / 365.25
      const recorded =
        (snapshotNetWorth(snapshots[snapshots.length - 1]) / snapshotNetWorth(snapshots[0])) **
          (1 / years) -
        1

      const aYearOn = new Date(TODAY.getFullYear() + 1, TODAY.getMonth(), TODAY.getDate())
      const projected =
        getNetWorth(
          getCurrentProfile(
            { ...profile, snapshots: [captureSnapshot(profile, toDateOnlyString(TODAY))] },
            aYearOn,
          ),
        ) /
          current -
        1

      // A percentage point, or a quarter of the rate for fast-growing profiles:
      // a loan reaching payoff is floored going forward but not winding back,
      // so a small gap survives where debt drives most of the movement. This
      // guards the order-of-magnitude mismatch, not the last decimal.
      const tolerance = Math.max(0.01, Math.abs(projected) / 4)
      expect(Math.abs(recorded - projected)).toBeLessThan(tolerance)
    }
  })

  test('records history at the irregular intervals people actually manage', () => {
    // An evenly spaced history is the one shape real data never has: people
    // record balances when they remember, after a raise, when a statement
    // lands. Long histories should also be sparse — a point every month for
    // years is nobody's habit, and it smears the chart into a band.
    const longest = presets
      .map((preset) => preset.data.profile.snapshots ?? [])
      .reduce((a, b) => (b.length > 1 && span(b) > span(a) ? b : a), [])

    const gaps = longest
      .slice(1)
      .map((snapshot, i) => daysBetween(longest[i].date, snapshot.date) / 30.44)

    expect(new Set(gaps.map(Math.round)).size).toBeGreaterThan(2)
    // Sparse: fewer than a third of the months in the span carry a point.
    expect(longest.length).toBeLessThan((span(longest) / 30.44) * 0.3)
  })

  test('gives each profile its own recording pattern and some texture', () => {
    const histories = presets
      .map((preset) => preset.data.profile.snapshots ?? [])
      .filter((snapshots) => snapshots.length >= 4)

    // Two profiles recording on exactly the same rhythm is the tell of a
    // generator, not of people.
    const patterns = histories.map((snapshots) =>
      snapshots
        .slice(1)
        .map((snapshot, i) => Math.round(daysBetween(snapshots[i].date, snapshot.date) / 30.44))
        .join(','),
    )
    expect(new Set(patterns).size).toBeGreaterThan(1)

    // Net worth that only ever rises, point after point, is a curve rather than
    // a record: markets have bad quarters even in a good decade.
    const dips = histories.some((snapshots) => {
      const worths = snapshots.map(snapshotNetWorth)
      const growing = worths[worths.length - 1] > worths[0]
      return growing && worths.some((worth, i) => i > 0 && worth < worths[i - 1])
    })
    expect(dips).toBe(true)
  })

  test('names are unique so the list keys stay stable', () => {
    expect(new Set(presets.map((p) => p.name)).size).toBe(presets.length)
  })

  test('snapshots run oldest to newest and never into the future', () => {
    for (const preset of presets) {
      const dates = (preset.data.profile.snapshots ?? []).map((s) => s.date)
      expect(dates).toEqual([...dates].sort())
      for (const date of dates) expect(date <= toDateOnlyString(TODAY)).toBe(true)
    }
  })

  test('the newest snapshot matches the profile it was captured from', () => {
    // The dashboard treats stored balances as "as of" the latest snapshot, so a
    // mismatch would make the page jump the moment it loads.
    for (const preset of presets) {
      const newest = latestSnapshot(preset.data.profile.snapshots)
      if (!newest) continue
      expect(newest.cash_amount).toBe(preset.data.profile.cash_amount ?? 0)
      expect(newest.investments).toEqual(
        (preset.data.profile.investments ?? []).map((i) => ({ id: i.id, balance: i.balance })),
      )
    }
  })

  test('plan date ranges are non-empty', () => {
    for (const preset of presets) {
      for (const plan of preset.data.portfolios) {
        expect(plan.end_date > plan.start_date).toBe(true)
      }
    }
  })

  test('covers the dashboard states worth exercising by hand', () => {
    const withSnapshots = presets.filter((p) => (p.data.profile.snapshots ?? []).length > 0)
    const todayDate = toDateOnlyString(TODAY)

    // A fresh profile (no staleness banner) and a stale one (banner + dashed tail).
    expect(
      withSnapshots.some((p) => latestSnapshot(p.data.profile.snapshots)?.date === todayDate),
    ).toBe(true)
    expect(
      withSnapshots.some((p) => (latestSnapshot(p.data.profile.snapshots)?.date ?? '') < todayDate),
    ).toBe(true)

    // A negative net worth, so the History axis has to reach below zero.
    expect(
      withSnapshots.some((p) => {
        const newest = latestSnapshot(p.data.profile.snapshots)
        return newest !== undefined && snapshotNetWorth(newest) < 0
      }),
    ).toBe(true)

    // A profile with no income at all, for the savings-rate fallback.
    expect(presets.some((p) => (p.data.profile.incomes ?? []).length === 0)).toBe(true)

    // More than one saved plan, to fill the Projections list.
    expect(presets.some((p) => p.data.portfolios.length > 1)).toBe(true)

    // A long history, so the X axis has to thin its month ticks. Measured as
    // elapsed time, not point count — the histories are deliberately sparse.
    expect(withSnapshots.some((p) => span(p.data.profile.snapshots ?? []) >= 365)).toBe(true)
  })

  test('keeps the realistic sample profiles rather than EUR-only stand-ins', () => {
    // The shipped samples are the reason non-EUR formatting, localized product
    // names and age-windowed cash flows get exercised at all; replacing them
    // with invented data would quietly drop that coverage.
    const currencies = new Set(presets.map((p) => p.data.profile.currency).filter(Boolean))
    expect(currencies).toContain('CZK')
    expect(currencies).toContain('HUF')
    expect(currencies).toContain('EUR')
  })

  test('at least one plan carries transfers, so thumbnails exercise that path', () => {
    const transfers = presets
      .flatMap((p) => p.data.portfolios)
      .flatMap((plan) => plan.transfers ?? [])
    expect(transfers.length).toBeGreaterThan(0)
  })
})
