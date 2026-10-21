import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1 } from '$lib/@snaha/kalkul-maths'
import {
  getAnnualExpensesTotal,
  getAnnualIncomeTotal,
  getFiPercent,
  getRunwayYears,
} from '$lib/financial-totals'
import { type YearlyProjection, type YearlyProjectionItem, yearOf } from '$lib/plan-projection'
import { type Portfolio, type Profile, type Snapshot, normalizeSnapshots } from '$lib/schemas'
import { profileAtSnapshot } from '$lib/snapshots'

/**
 * The year a snapshot closes. The projection's bars stand for the end of each
 * year, and a snapshot dated 1 January states the balances the year before it
 * ended on.
 */
function closingYear(snapshot: Snapshot): number {
  const year = yearOf(snapshot.date)
  return snapshot.date.endsWith('-01-01') ? year - 1 : year
}

/**
 * A snapshot in the shape of a projected year, `year` being the year it closes,
 * so chart, tooltip and inspector read it like one.
 */
export interface RecordedSample extends YearlyProjection {
  /** Date of the snapshot. */
  recordedOn: string
  /** Where the snapshot falls in time, on the axis `yearPosition` lays out. */
  position: number
}

/**
 * Where a date falls on a continuous year axis: 1 January 2025 is 2025, and
 * every later day of the year is as far past it as the share of the year gone.
 * A bar stands for the end of its year, so the 2024 bar sits at 2025.
 */
export function yearPosition(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const yearStart = Date.UTC(year, 0, 1)
  const yearLength = Date.UTC(year + 1, 0, 1) - yearStart
  return year + (Date.UTC(year, month - 1, day) - yearStart) / yearLength
}

/**
 * Every snapshot taken since a plan started, to hold against what the plan
 * projected.
 *
 * A snapshot from before the plan's start, or on it, is what the plan set out
 * from rather than how it went, so it does not count even in the plan's first
 * year.
 */
export function getRecordedPlanSamples(
  profile: Profile,
  plan: Pick<Portfolio, 'start_date' | 'end_date' | 'inflation_rate'>,
): RecordedSample[] {
  const endYear = yearOf(plan.end_date)
  return getRecordedSamples(profile, plan).filter(
    (s) => s.recordedOn > plan.start_date && s.year <= endYear,
  )
}

/**
 * Every snapshot the profile recorded, date-ascending, each where it falls in
 * time.
 *
 * Figures are restated in the plan's starting money as of the snapshot's own
 * date. The projection deflates the end of a year `n` years after its first by
 * (1 + inflation)^n; a snapshot part of the way through a year is deflated by
 * that part of the year's inflation too, so two taken a day apart either side
 * of 1 January differ by a day's inflation rather than a year's. A snapshot
 * from before the plan is inflated by the same rule.
 */
export function getRecordedSamples(
  profile: Profile,
  plan: Pick<Portfolio, 'start_date' | 'inflation_rate'>,
): RecordedSample[] {
  const startYear = yearOf(plan.start_date)
  const rate = DECIMAL_1.plus(plan.inflation_rate)
  return normalizeSnapshots(profile.snapshots ?? []).map((snapshot) => {
    const position = yearPosition(snapshot.date)
    const deflator = rate.pow(position - startYear - 1)
    const inPlanMoney = (value: number | Decimal) => new Decimal(value).div(deflator).toNumber()
    return {
      ...recordedYear(profile, snapshot, closingYear(snapshot), inPlanMoney),
      position,
    }
  })
}

/**
 * The latest of `samples` each year closed on, one per year: what a year's bar
 * is held against. A year without one is left out.
 */
export function latestOfEachYear(samples: RecordedSample[]): RecordedSample[] {
  // Date-ascending, so the last sample a year closed on wins.
  const byYear = new Map<number, RecordedSample>()
  for (const sample of samples) byYear.set(sample.year, sample)
  return [...byYear.values()]
}

/** How far a recorded figure is from the plan's: an amount, and a percentage of the plan's. */
export interface Difference {
  amount: number
  percent: number | undefined
}

/** How far a recorded figure is from the plan's, as an amount and a percentage of the plan's. */
export function differenceFromPlan(recorded: number, planned: number): Difference {
  const amount = new Decimal(recorded).minus(planned)
  return {
    amount: amount.toNumber(),
    percent: planned === 0 ? undefined : amount.div(Math.abs(planned)).mul(100).toNumber(),
  }
}

type Breakdown = Pick<YearlyProjection, 'cash' | 'investments' | 'tangibleAssets' | 'liabilities'>

/**
 * How far each recorded category is from the plan's. Debt counts against net
 * worth, so carrying more of it than planned is a negative difference, the
 * same as holding less of an asset, and the four add up to the net-worth one.
 */
export function differencesFromPlan(
  recorded: Breakdown,
  planned: Breakdown,
): Record<keyof Breakdown, Difference> {
  return {
    cash: differenceFromPlan(recorded.cash, planned.cash),
    investments: differenceFromPlan(recorded.investments, planned.investments),
    tangibleAssets: differenceFromPlan(recorded.tangibleAssets, planned.tangibleAssets),
    liabilities: differenceFromPlan(-recorded.liabilities, -planned.liabilities),
  }
}

function recordedYear(
  profile: Profile,
  snapshot: Snapshot,
  year: number,
  inPlanMoney: (value: number | Decimal) => number,
): Omit<RecordedSample, 'position'> {
  const at = profileAtSnapshot(profile, snapshot)
  const item = (id: string, name: string, value: number): YearlyProjectionItem => ({
    id,
    name,
    value: inPlanMoney(value),
  })
  const sum = (values: number[]) =>
    values.reduce<Decimal>((total, value) => total.plus(value), DECIMAL_0)

  const investments = at.investments ?? []
  const assets = at.tangible_assets ?? []
  const liabilities = at.liabilities ?? []

  const cash = new Decimal(at.cash_amount ?? 0)
  const investmentsTotal = sum(investments.map((i) => i.balance))
  const assetsTotal = sum(assets.map((a) => a.value))
  // Like the projection, the total counts a financed asset's debt with the
  // standalone loans, while the itemized list names only the standalone ones.
  const debtTotal = sum([
    ...liabilities.map((l) => l.outstanding_balance),
    ...assets.map((a) => (a.status === 'financed' ? (a.outstanding_balance ?? 0) : 0)),
  ])

  return {
    year,
    recordedOn: snapshot.date,
    cash: inPlanMoney(cash),
    investments: inPlanMoney(investmentsTotal),
    tangibleAssets: inPlanMoney(assetsTotal),
    liabilities: inPlanMoney(debtTotal),
    netWorth: inPlanMoney(cash.plus(investmentsTotal).plus(assetsTotal).minus(debtTotal)),
    investmentsByItem: investments.map((i) => item(i.id, i.name, i.balance)),
    tangibleAssetsByItem: assets.map((a) => item(a.id, a.name, a.value)),
    liabilitiesByItem: liabilities.map((l) => item(l.id, l.name, l.outstanding_balance)),
    totalIncome: inPlanMoney(getAnnualIncomeTotal(at)),
    totalExpenses: inPlanMoney(getAnnualExpensesTotal(at)),
    // Ratios of figures in the same money, so the restatement cancels out.
    fiPercent: getFiPercent(at),
    runwayYears: getRunwayYears(at),
    insufficientFundTransferIds: [],
    insufficientFundAssetIds: [],
    insufficientFundExpenseIds: [],
  }
}
