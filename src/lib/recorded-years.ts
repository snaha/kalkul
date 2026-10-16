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

/** A year before the plan starts, as a snapshot recorded it. */
export interface RecordedYear extends YearlyProjection {
  /** Date of the snapshot the year's figures come from. */
  recordedOn: string
}

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
 * The years leading up to a plan, from the profile's recorded history: one per
 * year, from the latest snapshot that year closed on, in the shape the
 * projection gives the years it projects. Chart, tooltip and inspector read
 * both the same way, and the year-on-year change across the plan's start
 * compares the first projected year against the last recorded one.
 *
 * Only the unbroken run of years right before the plan is returned. A year
 * without a snapshot ends it: its bar would have to be either left empty,
 * reading as net worth falling to nothing, or invented from its neighbours.
 *
 * Figures are restated in the plan's starting money, the way the projection
 * deflates the years after its start: a year `n` years before it is multiplied
 * by (1 + inflation)^n. Without that, the recorded years would sit in older,
 * cheaper money next to projected ones and overstate the growth between them.
 */
export function getRecordedYears(
  profile: Profile,
  plan: Pick<Portfolio, 'start_date' | 'inflation_rate'>,
): RecordedYear[] {
  const startYear = yearOf(plan.start_date)
  // Date-ascending, so the last snapshot a year closed on wins.
  const byYear = new Map<number, Snapshot>()
  for (const snapshot of normalizeSnapshots(profile.snapshots ?? [])) {
    byYear.set(closingYear(snapshot), snapshot)
  }

  const inflation = DECIMAL_1.plus(plan.inflation_rate)
  const years: RecordedYear[] = []
  for (let year = startYear - 1; byYear.has(year); year--) {
    const snapshot = byYear.get(year) as Snapshot
    const factor = inflation.pow(startYear - year)
    years.unshift(recordedYear(profile, snapshot, year, factor))
  }
  return years
}

function recordedYear(
  profile: Profile,
  snapshot: Snapshot,
  year: number,
  factor: Decimal,
): RecordedYear {
  const at = profileAtSnapshot(profile, snapshot)
  const inPlanMoney = (value: number | Decimal) => new Decimal(value).mul(factor).toNumber()
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
