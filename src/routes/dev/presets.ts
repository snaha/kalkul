import bence from '$examples/bence-toth-hu-25yo.kalkul.json'
import claire from '$examples/claire-moreau-fr-40yo.kalkul.json'
import martin from '$examples/martin-kovac-sk-30yo.kalkul.json'
import pavel from '$examples/pavel-dvorak-cz-50yo.kalkul.json'
import tereza from '$examples/tereza-svobodova-cz-20yo.kalkul.json'
import Decimal from 'decimal.js'

import { getCurrentProfile } from '$lib/current-values'
import {
  INSTALLMENT_PERIODS_PER_YEAR,
  financingToLiability,
  installmentPeriodRate,
} from '$lib/plan-projection'
import {
  type Portfolio,
  type Profile,
  type ProfileLiability,
  type Snapshot,
  storedDataSchema,
} from '$lib/schemas'
import { captureSnapshot } from '$lib/snapshots'
import { toDateOnlyString } from '$lib/utils'

export interface DevPreset {
  name: string
  description: string
  data: { profile: Profile; portfolios: Portfolio[] }
  /**
   * When set, the preset is written straight to storage as data last saved on
   * this date instead of being imported as a backup. That is the only way to
   * reach the pre-snapshot migration path: `load()` seeds the baseline from
   * `lastUpdated`, while `importBackup()` treats restored balances as
   * confirmed now and would hide the very behaviour under test.
   */
  storedAsOf?: Date
}

/**
 * The sample profiles shipped in `examples/` — the same files users import as
 * `.kalkul.json` backups. Reading them here keeps one curated set of realistic
 * data (localized products, real fee structures, life-stage cash flows) rather
 * than a second hand-written copy that drifts.
 *
 * Parsed rather than cast: TypeScript widens JSON literals to `string`, and a
 * schema change that the samples missed should fail loudly here.
 */
function sample(json: unknown): { profile: Profile; portfolios: Portfolio[] } {
  return storedDataSchema.pick({ profile: true, portfolios: true }).parse(json)
}

/** A point in a generated snapshot history. */
interface HistoryStep {
  /** Whole months before the reference date. 0 means the reference date itself. */
  monthsAgo: number
  /** Years between this point and the newest one, for winding loans back. */
  years: number
  /** Liquid balances at that point as a fraction of the newest point's. */
  factor: number
}

/**
 * The 1st of the month `monthsAgo` before `today`. The 1st keeps generated
 * dates in order regardless of today's day-of-month (subtracting a month from
 * the 31st would otherwise roll forward).
 */
function monthsBefore(today: Date, monthsAgo: number): Date {
  return new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1)
}

/** Date-only string for a point `monthsAgo` before `today`. */
function historyDate(today: Date, monthsAgo: number): string {
  if (monthsAgo === 0) return toDateOnlyString(today)
  return toDateOnlyString(monthsBefore(today, monthsAgo))
}

/**
 * A loan's balance `years` before its current one, undoing the amortization the
 * projection applies going forward: each installment period adds interest and
 * takes a payment off, so running it backwards divides the interest out and
 * puts the payment back.
 */
function unamortized(liability: ProfileLiability, years: number): number {
  const periods = Math.round(years * INSTALLMENT_PERIODS_PER_YEAR[liability.installment_frequency])
  const rate = installmentPeriodRate(liability).plus(1)
  let balance = new Decimal(liability.outstanding_balance)
  for (let period = 0; period < periods; period++) {
    balance = balance.plus(liability.installment_amount).div(rate)
  }
  return balance.toDecimalPlaces(2).toNumber()
}

/**
 * The balances `years` before today's, wound back the way the projection winds
 * them forward: liquid balances scaled by `liquidFactor`, loans un-amortized,
 * and property values left alone — the projection holds those flat, so moving
 * them here would put a step in the chart at the last snapshot.
 */
function rewoundSnapshot(
  profile: Profile,
  date: string,
  years: number,
  liquidFactor: number,
): Snapshot {
  const round = (value: number) => Math.round(value)
  const snapshot = captureSnapshot(profile, date)
  const financingFor = (id: string) => {
    const asset = (profile.tangible_assets ?? []).find((candidate) => candidate.id === id)
    return asset ? financingToLiability(asset) : undefined
  }

  return {
    ...snapshot,
    cash_amount: round((snapshot.cash_amount ?? 0) * liquidFactor),
    investments: snapshot.investments?.map((investment) => ({
      ...investment,
      balance: round(investment.balance * liquidFactor),
    })),
    tangible_assets: snapshot.tangible_assets?.map((asset) => {
      const financing = financingFor(asset.id)
      return {
        ...asset,
        outstanding_balance: financing
          ? round(unamortized(financing, years))
          : asset.outstanding_balance,
      }
    }),
    liabilities: snapshot.liabilities?.map((entry) => {
      const liability = (profile.liabilities ?? []).find((l) => l.id === entry.id)
      return {
        ...entry,
        outstanding_balance: liability
          ? round(unamortized(liability, years))
          : entry.outstanding_balance,
      }
    }),
  }
}

/** Cash plus investments — the balances that move on their own year to year. */
function liquidTotal(profile: Profile): number {
  return (
    (profile.cash_amount ?? 0) +
    (profile.investments ?? []).reduce((sum, investment) => sum + investment.balance, 0)
  )
}

/**
 * The yearly change this profile's own projection produces in its liquid
 * balances — investments compounding at their effective APY, cash accruing what
 * income leaves after expenses and debt service.
 *
 * History is wound back at exactly this rate so the recorded line runs into the
 * projected tail without a kink. The dashboard continues the chart with this
 * model, so any other rate would show growth changing pace on the day the last
 * snapshot happens to fall.
 */
function impliedLiquidGrowth(profile: Profile, today: Date, fallback = 0.06): number {
  const current = liquidTotal(profile)
  if (current <= 0) return fallback

  const seeded: Profile = {
    ...profile,
    snapshots: [captureSnapshot(profile, toDateOnlyString(today))],
  }
  const aYearOn = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
  const growth = liquidTotal(getCurrentProfile(seeded, aYearOn)) / current - 1
  // A shrinking profile is fine to draw; a factor at or below zero is not.
  return Math.max(growth, -0.5)
}

interface HistoryOptions {
  /** Where the history stops, in whole months before today. */
  latestMonthsAgo?: number
  /** Months between recorded points. Years of monthly dots would be a smear. */
  stepMonths?: number
}

/**
 * Back-fills a snapshot history by winding today's balances back at the rate
 * this profile actually grows at. Cheaper than hand-writing every point, and it
 * keeps the invariant the dashboard relies on: the newest snapshot matches the
 * profile exactly.
 */
function withHistory(
  profile: Profile,
  today: Date,
  months: number,
  { latestMonthsAgo = 0, stepMonths = 1 }: HistoryOptions = {},
): Profile {
  const growth = impliedLiquidGrowth(profile, today)
  const steps: HistoryStep[] = []
  for (let monthsAgo = latestMonthsAgo; monthsAgo <= months; monthsAgo += stepMonths) {
    // Exactly 1 and 0 at the newest step, keeping it equal to the profile's
    // balances — the dashboard would otherwise jump the moment it loads.
    const years = (monthsAgo - latestMonthsAgo) / 12
    steps.push({ monthsAgo, years, factor: 1 / (1 + growth) ** years })
  }

  return {
    ...profile,
    snapshots: steps
      .sort((a, b) => b.monthsAgo - a.monthsAgo)
      .map((step) =>
        rewoundSnapshot(profile, historyDate(today, step.monthsAgo), step.years, step.factor),
      ),
  }
}

function plan(
  today: Date,
  id: string,
  name: string,
  notes: string,
  endYearsOut: number,
  inflationRate = 0.02,
): Portfolio {
  return {
    id,
    name,
    notes,
    start_date: toDateOnlyString(new Date(today.getFullYear(), today.getMonth(), 1)),
    end_date: toDateOnlyString(new Date(today.getFullYear() + endYearsOut, 0, 1)),
    inflation_rate: inflationRate,
  }
}

/**
 * A profile with more debt than assets. No sample covers this, and it is the
 * only way to see the History axis reach below zero.
 */
const UNDERWATER: Profile = {
  name: 'Alex Rivera',
  email: '',
  birth_date: '1998-08-20',
  location: 'FR',
  currency: 'EUR',
  cash_amount: 1_200,
  has_investments: true,
  investments: [{ id: 'inv-1', name: 'Robo-advisor', balance: 3_000, apy: 6 }],
  has_tangible_assets: true,
  tangible_assets: [
    {
      id: 'ta-1',
      name: 'Car',
      value: 9_000,
      status: 'financed',
      // Underwater on the car too: the loan outlasted the resale value.
      outstanding_balance: 11_500,
      installment_frequency: 'monthly',
      annual_rate: 5.9,
      installment_amount: 280,
      remaining_term: 4,
    },
  ],
  has_liabilities: true,
  liabilities: [
    {
      id: 'li-1',
      name: 'Student loan',
      outstanding_balance: 42_000,
      installment_frequency: 'monthly',
      annual_rate: 3.5,
      installment_amount: 350,
      remaining_term: 12,
    },
    {
      id: 'li-2',
      name: 'Credit card',
      outstanding_balance: 4_800,
      installment_frequency: 'monthly',
      annual_rate: 18.9,
      installment_amount: 200,
      remaining_term: 3,
    },
  ],
  incomes: [
    {
      id: 'inc-1',
      name: 'Salary',
      amount: 2_400,
      frequency: 'monthly',
      withhold_taxes: true,
      tax_percentage: 20,
      start: 'immediately',
      end: 'never',
      change_over_time: 'match_inflation',
    },
  ],
  expenses: [
    {
      id: 'exp-1',
      name: 'Rent',
      amount: 850,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'match_inflation',
    },
  ],
}

/**
 * Scenarios for exercising the app by hand. The realistic ones are the shipped
 * sample profiles, each given a distinct dashboard state on top (fresh, stale,
 * long history, several projections); the rest are deliberately synthetic
 * because they exist to hit an edge the samples don't cover.
 *
 * Takes `today` so generated dates are relative to when the preset is loaded
 * (and so the set is deterministic under test).
 */
export function getDevPresets(today: Date): DevPreset[] {
  const terezaData = sample(tereza)
  const benceData = sample(bence)
  const martinData = sample(martin)
  const claireData = sample(claire)
  const pavelData = sample(pavel)

  return [
    {
      name: 'Empty (fresh start)',
      description: 'Clears all data. Shows the hero landing page.',
      data: { profile: { name: '', email: '' }, portfolios: [] },
    },
    {
      name: 'No finances',
      description: 'Name set, nothing else. Both dashboard panels show their empty state.',
      data: {
        profile: { name: 'Jane Doe', email: '', location: 'CZ', currency: 'CZK' },
        portfolios: [],
      },
    },
    {
      name: 'Tereza, 20 — student, cash only',
      description:
        'No investments or property, income that starts on a future date. Single-segment pie; savings rate driven entirely by cash flows. Last confirmed a month ago, so Quick update is available.',
      data: {
        ...terezaData,
        profile: withHistory(terezaData.profile, today, 5, { latestMonthsAgo: 1 }),
      },
    },
    {
      name: 'Martin, 30 — updated today',
      description:
        'Mortgage, ETF and pension savings, confirmed today. No staleness banner; History ends on a solid point. The only preset with nothing left to confirm — every other one is stale so Quick update can record a snapshot.',
      data: {
        ...martinData,
        // The deliberate exception: every other preset stops short of today so
        // recording a snapshot is something to try, but the confirmed-today
        // dashboard still needs a fixture of its own.
        profile: withHistory(martinData.profile, today, 8),
        portfolios: [
          plan(today, 'plan-1', 'Pay the house off early', 'Overpay the mortgage from year 3.', 35),
        ],
      },
    },
    {
      name: 'Bence, 25 — needs a quick update',
      description:
        'HUF amounts, car loan and Diákhitel. Last confirmed three months ago: staleness banner, projected figures, dashed History tail.',
      data: {
        ...benceData,
        profile: withHistory(benceData.profile, today, 9, { latestMonthsAgo: 3 }),
      },
    },
    {
      name: 'Claire, 40 — two years of history',
      description:
        'Three investments with entry/exit fees, two financed properties, one plan with a recurring transfer. Dense History chart crossing a year boundary, ending a month back so it can be extended.',
      data: {
        ...claireData,
        profile: withHistory(claireData.profile, today, 24, { latestMonthsAgo: 1 }),
      },
    },
    {
      name: 'Martin, 30 — six years of quarterly history',
      description:
        'A long-standing user: balances recorded every quarter since 2020, last confirmed two months ago. The X axis has to thin its month ticks down to a handful of years, and the chart spans several year boundaries.',
      data: {
        ...martinData,
        // Quarterly rather than monthly — 70-odd monthly dots would smear into
        // a band, and nobody records their balances every month for six years.
        profile: withHistory(martinData.profile, today, 72, {
          latestMonthsAgo: 2,
          stepMonths: 3,
        }),
      },
    },
    {
      name: 'Pavel, 50 — three projections',
      description:
        'Large CZK portfolio and a retirement plan with transfers, plus two variants. Fills the Projections panel below the automatic one. Two months stale.',
      data: {
        profile: withHistory(pavelData.profile, today, 12, { latestMonthsAgo: 2 }),
        portfolios: [
          ...pavelData.portfolios,
          plan(today, 'plan-early', 'Retire at 60', 'Five years earlier, same spending.', 40),
          plan(today, 'plan-inflation', 'High inflation', 'Same plan at 6% inflation.', 40, 0.06),
        ],
      },
    },
    {
      name: 'Claire, 40 — saved before snapshots',
      description:
        'Legacy data: balances but no history, last written four months ago. Written straight to storage, so the baseline is seeded from that date on load — staleness banner, projected figures, two-point History. Exercises the migration, tax-netted accrual and loan amortization together.',
      // Deliberately the untouched sample: the shipped example files carry no
      // snapshots, which is exactly the shape data had before they existed.
      data: claireData,
      storedAsOf: monthsBefore(today, 4),
    },
    {
      name: 'Underwater — negative net worth',
      description:
        'Debts exceed assets. History axis extends below zero and financial independence sits at 0%. Two months stale, so a confirmation can push it further under.',
      data: {
        profile: withHistory(UNDERWATER, today, 8, { latestMonthsAgo: 2 }),
        portfolios: [],
      },
    },
    {
      name: 'Pavel, 50 — no income recorded',
      description:
        'Same portfolio with the income lines removed. Savings rate falls back to its "add your income" hint while runway and FI still compute. A month stale, so Quick update shows cash draining with nothing coming in.',
      data: {
        profile: withHistory({ ...pavelData.profile, incomes: [] }, today, 10, {
          latestMonthsAgo: 1,
        }),
        portfolios: [],
      },
    },
  ]
}
