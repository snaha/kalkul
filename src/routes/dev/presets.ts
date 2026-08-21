import bence from '$examples/bence-toth-hu-25yo.kalkul.json'
import claire from '$examples/claire-moreau-fr-40yo.kalkul.json'
import martin from '$examples/martin-kovac-sk-30yo.kalkul.json'
import pavel from '$examples/pavel-dvorak-cz-50yo.kalkul.json'
import tereza from '$examples/tereza-svobodova-cz-20yo.kalkul.json'

import { type Portfolio, type Profile, type Snapshot, storedDataSchema } from '$lib/schemas'
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
  /**
   * Liquid balances at that point as a fraction of today's. The newest step is
   * always 1: the profile holds the balances as of its latest snapshot, and the
   * dashboard would otherwise show a jump the moment it loads.
   */
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

function scaleSnapshot(snapshot: Snapshot, factor: number): Snapshot {
  // Property values drift far more slowly than portfolios, and debts run the
  // other way — they were larger before this year's installments.
  const slow = 0.7 + 0.3 * factor
  const round = (value: number) => Math.round(value)
  return {
    ...snapshot,
    cash_amount: round((snapshot.cash_amount ?? 0) * factor),
    investments: snapshot.investments?.map((i) => ({ ...i, balance: round(i.balance * factor) })),
    tangible_assets: snapshot.tangible_assets?.map((a) => ({
      ...a,
      value: round(a.value * slow),
      outstanding_balance:
        a.outstanding_balance === undefined ? undefined : round(a.outstanding_balance / slow),
    })),
    liabilities: snapshot.liabilities?.map((l) => ({
      ...l,
      outstanding_balance: round(l.outstanding_balance / slow),
    })),
  }
}

/**
 * Back-fills a snapshot history by scaling today's balances into the past.
 * Cheaper than hand-writing every point, and it keeps the invariant the
 * dashboard relies on: the newest snapshot matches the profile exactly.
 */
function withHistory(profile: Profile, today: Date, steps: HistoryStep[]): Profile {
  const ordered = [...steps].sort((a, b) => b.monthsAgo - a.monthsAgo)
  return {
    ...profile,
    snapshots: ordered.map((step) =>
      scaleSnapshot(captureSnapshot(profile, historyDate(today, step.monthsAgo)), step.factor),
    ),
  }
}

/**
 * Evenly spaced monthly history from `months` ago up to `latestMonthsAgo`,
 * worked backwards from today's balances at `annualGrowth` a year.
 *
 * The rate matters for more than realism: the dashboard continues the History
 * chart with a projected tail growing at the profile's own APY and savings. A
 * fabricated past that climbed several times faster than that makes the tail
 * read as a flat line — the growth has not stopped, the recorded slope was
 * never achievable.
 */
function steadyGrowth(months: number, latestMonthsAgo = 0, annualGrowth = 0.08): HistoryStep[] {
  const count = months - latestMonthsAgo
  return Array.from({ length: count + 1 }, (_, i) => {
    const monthsAgo = months - i
    // Exactly 1 at the newest step, keeping it equal to the profile's balances.
    return { monthsAgo, factor: 1 / (1 + annualGrowth) ** ((monthsAgo - latestMonthsAgo) / 12) }
  })
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
        profile: withHistory(terezaData.profile, today, steadyGrowth(5, 1, 0.5)),
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
        profile: withHistory(martinData.profile, today, steadyGrowth(8, 0, 0.12)),
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
        profile: withHistory(benceData.profile, today, steadyGrowth(9, 3, 0.18)),
      },
    },
    {
      name: 'Claire, 40 — two years of history',
      description:
        'Three investments with entry/exit fees, two financed properties, one plan with a recurring transfer. Dense History chart crossing a year boundary, ending a month back so it can be extended.',
      data: {
        ...claireData,
        profile: withHistory(claireData.profile, today, steadyGrowth(24, 1, 0.09)),
      },
    },
    {
      name: 'Pavel, 50 — three projections',
      description:
        'Large CZK portfolio and a retirement plan with transfers, plus two variants. Fills the Projections panel below the automatic one. Two months stale.',
      data: {
        profile: withHistory(pavelData.profile, today, steadyGrowth(12, 2, 0.06)),
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
        profile: withHistory(UNDERWATER, today, steadyGrowth(8, 2, 0.25)),
        portfolios: [],
      },
    },
    {
      name: 'Pavel, 50 — no income recorded',
      description:
        'Same portfolio with the income lines removed. Savings rate falls back to its "add your income" hint while runway and FI still compute. A month stale, so Quick update shows cash draining with nothing coming in.',
      data: {
        profile: withHistory(
          { ...pavelData.profile, incomes: [] },
          today,
          steadyGrowth(10, 1, 0.04),
        ),
        portfolios: [],
      },
    },
  ]
}
