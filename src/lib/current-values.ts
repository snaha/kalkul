import Decimal from 'decimal.js'

import { DECIMAL_0, DECIMAL_1, daysBetween } from '$lib/@snaha/kalkul-maths'
import { sharedItems } from '$lib/plan-owned'
import {
  CASH_ENDPOINT,
  INSTALLMENT_PERIODS_PER_YEAR,
  annualizedAmount,
  applyEntryFee,
  applyExitFee,
  effectiveInvestmentApy,
  financingToLiability,
  installmentPeriodRate,
  isActiveOn,
  isHeldOn,
  isOwnedOn,
  remainingInstallmentPeriods,
  yearOf,
} from '$lib/plan-projection'
import type { TimingWindow } from '$lib/plan-projection'
import type { Profile, ProfileLiability, RemainingTermUnit } from '$lib/schemas'
import { latestSnapshot } from '$lib/snapshots'
import { toDateOnlyString } from '$lib/utils'

const DAYS_PER_YEAR = 365.25
/**
 * Projected balances are rounded to the cent. Compounding a fraction of a year
 * leaves a long tail of digits that is pure noise at money scale, and it would
 * otherwise be shown verbatim in the Quick update inputs.
 */
const MONEY_DECIMALS = 2

/**
 * One recurring transfer as a pair of yearly rates: what leaves the source and
 * what reaches the destination once the fees have been taken.
 */
interface TransferLeg {
  from: string
  to: string
  out: Decimal
  in: Decimal
}

/** What is moving on `asOf`: the cash flow, and the transfers running that day. */
interface AnnualFlows {
  /** Net yearly cash flow from incomes, expenses and debt service. */
  cash: Decimal
  transfers: TransferLeg[]
}

/**
 * Net yearly cash flow from everything actually running on `asOf`: take-home
 * income, less living expenses, less debt service on loans that still carry a
 * balance.
 *
 * Deliberately not the profile-level totals in `financial-totals.ts`, which
 * ignore start/end windows: those answer "at today's flow levels" for the
 * savings rate, FI % and runway. Accrual is a different question — a salary
 * that starts next year must not top up today's cash, and an expense that
 * ended last spring must not keep draining it.
 */
function netAnnualCashFlowOn(profile: Profile, asOf: Date, birthYear: number | undefined): Decimal {
  const active = <T extends TimingWindow>(items: T[] | undefined): T[] =>
    (items ?? []).filter((item) => isActiveOn(item, asOf, birthYear))

  const income = active(sharedItems(profile.incomes)).reduce<Decimal>(
    (sum, i) => sum.plus(annualizedAmount(new Decimal(i.amount), i.frequency)),
    DECIMAL_0,
  )
  const expenses = active(sharedItems(profile.expenses)).reduce<Decimal>(
    (sum, e) => sum.plus(annualizedAmount(new Decimal(e.amount), e.frequency)),
    DECIMAL_0,
  )
  // Standalone loans carry no start/end window of their own — one is serviced
  // for as long as it still has a balance to pay off. A property's financing
  // does have one: nobody pays installments on a purchase that has not
  // happened, or on a mortgage settled by a sale that already has.
  const debtService = [
    ...sharedItems(profile.liabilities),
    ...sharedItems(profile.tangible_assets).filter(
      (a) => a.status === 'financed' && isOwnedOn(a, asOf, birthYear),
    ),
  ].reduce<Decimal>(
    (sum, loan) =>
      (loan.outstanding_balance ?? 0) > 0
        ? sum.plus(
            annualizedAmount(
              new Decimal(loan.installment_amount ?? 0),
              loan.installment_frequency ?? 'monthly',
            ),
          )
        : sum,
    DECIMAL_0,
  )

  return income.minus(expenses).minus(debtService)
}

/**
 * The yearly rate at which every balance is moving on `asOf`: the cash flow
 * above, plus the recurring transfers running that day.
 *
 * A regular contribution is the whole reason investments grow faster than
 * their APY, so leaving transfers out would put the drift straight into the
 * Quick update inputs — cash too high by every contribution made since the
 * snapshot, the destination too low by the same — and the user would confirm
 * that split as their own word on the balances.
 *
 * The source loses the full amount and the destination receives what is left
 * after the exit fee on the way out and the upfront entry fee on the way in,
 * charged with `plan-projection`'s own helpers so the two agree. Transfers
 * only ever run between cash and investments, which is what the editor
 * offers, so anything pointing elsewhere — including at an asset the profile
 * no longer holds — is skipped rather than half-applied. So is one whose
 * investment is not held on the date: the projection refuses to move money
 * into a position the user has not bought yet, or out of one already sold,
 * and the carry-forward has to agree with it or Quick update would offer the
 * user a split the projection never makes.
 *
 * Two kinds are deliberately left out, both because they are events rather
 * than rates and this accrual only knows rates:
 *
 * - **One-time transfers**, which fire in a single month of the plan's
 *   timeline.
 * - **"Transfer all" sweeps**, whose amount is whatever the source holds at
 *   the moment they execute.
 *
 * Growth within the window is ignored for the same reason it is on incomes and
 * expenses: the amount running today is the rate for the whole of it.
 */
function annualFlowsOn(profile: Profile, asOf: Date): AnnualFlows {
  const birthYear = profile.birth_date ? yearOf(profile.birth_date) : undefined
  const flows: AnnualFlows = {
    cash: netAnnualCashFlowOn(profile, asOf, birthYear),
    transfers: [],
  }

  const investmentsById = new Map((profile.investments ?? []).map((i) => [i.id, i]))
  const isEndpointActive = (id: string): boolean => {
    if (id === CASH_ENDPOINT) return true
    const investment = investmentsById.get(id)
    return investment !== undefined && isHeldOn(investment, asOf, birthYear)
  }

  for (const transfer of sharedItems(profile.transfers)) {
    if (transfer.schedule !== 'recurring' || transfer.transfer_all) continue
    if (!isEndpointActive(transfer.from_asset_id) || !isEndpointActive(transfer.to_asset_id))
      continue
    // Recurring transfers carry the same start/end shape as incomes and
    // expenses, with the projection's own defaults for the optional fields.
    const running = isActiveOn(
      {
        start: transfer.start ?? 'immediately',
        start_year: transfer.start_year,
        start_month: transfer.start_month,
        start_age: transfer.start_age,
        end: transfer.end ?? 'never',
        end_year: transfer.end_year,
        end_month: transfer.end_month,
        end_age: transfer.end_age,
      },
      asOf,
      birthYear,
    )
    if (!running) continue

    const gross = annualizedAmount(new Decimal(transfer.amount), transfer.frequency ?? 'monthly')
    if (gross.isZero()) continue
    flows.transfers.push({
      from: transfer.from_asset_id,
      to: transfer.to_asset_id,
      out: gross,
      in: applyEntryFee(
        investmentsById.get(transfer.to_asset_id),
        applyExitFee(investmentsById.get(transfer.from_asset_id), gross),
      ),
    })
  }

  return flows
}

/**
 * The balances once the transfers have run over the window, each source paying
 * out no more than it can fund.
 *
 * A source that cannot cover everything promised out of it — cash outrun by a
 * contribution between jobs, a fund swept for more than it holds — pays out
 * what it has, and every transfer out of it is scaled down by the same factor
 * on both legs. Flooring the source alone while the destination is paid in
 * full would invent the shortfall out of nothing, and unlike a cash shortfall
 * from expenses that would not cancel in net worth: it would show up on the
 * History chart. The projection refuses such a transfer outright and flags it
 * (`insufficientFundTransferIds`); over a window measured in fractions of a
 * year, paying what was fundable is the closer estimate.
 *
 * What a source can fund is its own balance after its own movement plus what
 * the other transfers actually deliver to it — after their own scaling, not at
 * face value. A position wound down through cash into another one is one chain
 * of that kind, and counting the first leg's promise rather than its payment
 * would let cash pass on money that never arrived.
 *
 * Solved by raising the factors from zero rather than lowering them from one.
 * Each round pays every source only what the previous round's factors actually
 * delivered, so no round can promise more than the one before it funded — the
 * result is safe to use at every step, and one round per source is enough to
 * carry a payment along the longest chain that has an end. Transfers that
 * circle back on each other have no such length; they settle low rather than
 * high, which under-pays a little and invents nothing.
 */
function settleTransfers(
  before: Map<string, Decimal>,
  transfers: TransferLeg[],
  yearFraction: Decimal,
): Map<string, Decimal> {
  const over = (rate: Decimal) => rate.mul(yearFraction)
  const add = (map: Map<string, Decimal>, id: string, amount: Decimal) =>
    map.set(id, (map.get(id) ?? DECIMAL_0).plus(amount))

  const promisedOut = new Map<string, Decimal>()
  for (const leg of transfers) add(promisedOut, leg.from, over(leg.out))

  // Nothing delivered yet, so the first round funds each source out of its own
  // balance alone; every round after it adds what the last one paid in.
  let factor = new Map<string, Decimal>([...promisedOut.keys()].map((id) => [id, DECIMAL_0]))
  for (let round = 0; round < promisedOut.size; round++) {
    const paidIn = new Map<string, Decimal>()
    for (const leg of transfers) {
      add(paidIn, leg.to, over(leg.in).mul(factor.get(leg.from) ?? DECIMAL_1))
    }

    const next = new Map<string, Decimal>()
    for (const [id, promised] of promisedOut) {
      const fundable = Decimal.max(
        (before.get(id) ?? DECIMAL_0).plus(paidIn.get(id) ?? DECIMAL_0),
        DECIMAL_0,
      )
      next.set(id, promised.greaterThan(fundable) ? fundable.div(promised) : DECIMAL_1)
    }

    const settled = [...next].every(([id, value]) => value.equals(factor.get(id) ?? DECIMAL_0))
    factor = next
    if (settled) break
  }

  const after = new Map(before)
  for (const leg of transfers) {
    const scale = factor.get(leg.from) ?? DECIMAL_1
    add(after, leg.from, over(leg.out).mul(scale).negated())
    add(after, leg.to, over(leg.in).mul(scale))
  }
  return after
}

/**
 * A partly elapsed term is written back to two decimals — the coarsest figure
 * that still round-trips, and the one that reads as a number rather than as
 * machine output in the financial-data form the user edits it in.
 *
 * `remainingInstallmentPeriods` rounds the term to a whole installment count,
 * so writing it back only has to land within half a period of the exact value.
 * Half a period is 1/104 of a year on the tightest supported combination
 * (weekly installments on a term stated in years); two decimals are never more
 * than 1/200 of a year out, so the count comes back unchanged.
 */
const TERM_DECIMALS = 2

/**
 * A period count back in the unit the loan states its term in. Writing years
 * into a term the user entered in months would leave `remaining_term_unit`
 * reinterpreting the number — 31 months read back as 2.5833 months — and
 * collapse the payoff date on every carried-forward update.
 */
function periodsToTerm(
  periods: number,
  periodsPerYear: number,
  unit: RemainingTermUnit | undefined,
): number {
  const years = new Decimal(periods).div(periodsPerYear)
  return (unit === 'months' ? years.mul(12) : years).toDecimalPlaces(TERM_DECIMALS).toNumber()
}

/** Where a loan stands after part of its schedule has been paid. */
interface AmortizedLoan {
  outstanding_balance: number
  remaining_term: number
}

/**
 * A liability after `yearFraction` of a year of payments, amortized on the same
 * terms `simulateLiability` uses in the projection: each whole installment
 * period that fits in the window adds the period's interest and takes one
 * installment off, floored at zero, with the loan's final scheduled installment
 * settling whatever is left (the same balloon the projection pays, so a loan
 * that under-amortizes on paper still ends with its term instead of carrying a
 * residual balance forever).
 *
 * The elapsed installments come off `remaining_term` as well. Carrying the
 * balance forward without the term would restart the loan's clock on every
 * confirmed update and walk the payoff date into the future.
 *
 * Only whole periods count — a part-paid month leaves the balance where the
 * last installment put it. The cash side, by contrast, charges debt service
 * continuously over the window, so a loan that pays off partway through keeps
 * draining cash to the end of it. That residual is small at this granularity
 * and not worth threading a payoff date through the accrual for.
 */
function amortizeLoan(liability: ProfileLiability, yearFraction: Decimal): AmortizedLoan {
  const periodsPerYear = INSTALLMENT_PERIODS_PER_YEAR[liability.installment_frequency]
  const periodRate = installmentPeriodRate(liability)
  const installment = new Decimal(liability.installment_amount)
  let periodsRemaining = remainingInstallmentPeriods(liability)
  // Never pay past the end of the loan's own term.
  const periods = Math.min(
    Math.floor(yearFraction.mul(periodsPerYear).toNumber()),
    periodsRemaining,
  )

  let balance = new Decimal(liability.outstanding_balance)
  for (let period = 0; period < periods; period++) {
    if (balance.lessThanOrEqualTo(0)) {
      // Paid off early: the schedule is over, whatever the term said.
      periodsRemaining = 0
      break
    }
    const grossDue = balance.plus(balance.mul(periodRate))
    const payment = periodsRemaining === 1 ? grossDue : Decimal.min(installment, grossDue)
    balance = grossDue.minus(payment)
    if (balance.lessThan(0)) balance = DECIMAL_0
    periodsRemaining -= 1
  }

  return {
    outstanding_balance: Decimal.max(balance, DECIMAL_0).toDecimalPlaces(MONEY_DECIMALS).toNumber(),
    remaining_term: periodsToTerm(periodsRemaining, periodsPerYear, liability.remaining_term_unit),
  }
}

/**
 * Balances as they stand *today*, projected forward from the most recent
 * snapshot. The stored profile holds the values the user last confirmed; this
 * grows investments at their effective APY, accrues cash at the net of income,
 * expenses and debt service over the elapsed time, moves the recurring
 * transfers running in it between cash and the investments, and pays down loan
 * balances by the installments that fell due — taking those installments off
 * each loan's remaining term as well, so its payoff date stays where it was.
 *
 * Tangible asset *values* are returned untouched: they only change through an
 * explicit edit in financial data, and Quick update does not ask about them.
 * The debt secured against a financed asset is amortized like any other loan —
 * leaving it at the snapshot value while cash pays the installments would bias
 * net worth down by every principal payment made since.
 *
 * Returns the profile unchanged when nothing has elapsed — no snapshots yet, or
 * the latest one is dated today (or, defensively, in the future).
 */
export function getCurrentProfile(profile: Profile, today: Date): Profile {
  const snapshot = latestSnapshot(profile.snapshots)
  if (!snapshot) return profile

  const todayDate = toDateOnlyString(today)
  if (snapshot.date >= todayDate) return profile

  const yearFraction = new Decimal(daysBetween(snapshot.date, todayDate)).div(DAYS_PER_YEAR)

  // Which flows are running is evaluated once, as of today: a flow that
  // started or ended partway through the elapsed window counts for all of it or
  // none of it. Integrating piecewise over every window edge would buy little
  // for a figure the user sees and re-confirms in Quick update.
  const flows = annualFlowsOn(profile, today)
  const birthYear = profile.birth_date ? yearOf(profile.birth_date) : undefined

  // Every balance after its own movement and before the transfers: cash after
  // the flows running on it, each investment after its growth. Growth first,
  // then the transfers over it — the order the projection's year loop uses, so
  // a contribution does not compound in the same window it arrives in.
  //
  // A position the profile does not hold on the date is left exactly as
  // stored. Its balance is a statement about a different year — what the plan
  // will buy out of cash, or what a past exit already liquidated — so it is
  // earning nothing today, and the transfers pointing at it are skipped for
  // the same reason. It stays in the list at that figure rather than being
  // dropped or zeroed: the projections beside it need the planned amount, and
  // Quick update must never be able to confirm it away.
  const before = new Map<string, Decimal>([
    [CASH_ENDPOINT, new Decimal(profile.cash_amount ?? 0).plus(flows.cash.mul(yearFraction))],
    ...(profile.investments ?? []).map((investment): [string, Decimal] => [
      investment.id,
      isHeldOn(investment, today, birthYear)
        ? new Decimal(investment.balance).mul(
            effectiveInvestmentApy(investment).div(100).plus(1).pow(yearFraction),
          )
        : new Decimal(investment.balance),
    ]),
  ])
  const after = settleTransfers(before, flows.transfers, yearFraction)
  // Cash outrun by expenses stops at zero rather than going into overdraft —
  // the shortfall is not modelled as debt. Transfers never take a balance
  // below zero on their own; see `settleTransfers`.
  const balance = (id: string) =>
    Decimal.max(after.get(id) ?? DECIMAL_0, DECIMAL_0)
      .toDecimalPlaces(MONEY_DECIMALS)
      .toNumber()

  return {
    ...profile,
    cash_amount: balance(CASH_ENDPOINT),
    investments: profile.investments?.map((investment) => ({
      ...investment,
      balance: balance(investment.id),
    })),
    liabilities: profile.liabilities?.map((liability) => ({
      ...liability,
      ...amortizeLoan(liability, yearFraction),
    })),
    tangible_assets: profile.tangible_assets?.map((asset) => {
      // A property not owned on the date is left alone for the same reason a
      // position not held is: its mortgage is not being paid yet, or was
      // settled by the sale.
      if (!isOwnedOn(asset, today, birthYear)) return asset
      // Undefined for a fully owned asset, or one whose financing terms are
      // incomplete — nothing to amortize either way.
      const financing = financingToLiability(asset)
      if (!financing) return asset
      return { ...asset, ...amortizeLoan(financing, yearFraction) }
    }),
  }
}

/** One numeric field per item, by id, for comparing two versions of a list. */
function fieldIndex<T extends { id: string }>(
  items: T[] | undefined,
  pick: (item: T) => number | undefined,
): Map<string, number | undefined> {
  return new Map((items ?? []).map((item) => [item.id, pick(item)]))
}

/**
 * The balances an edit states outright, rather than handing back whole lists
 * rebuilt from the stored values.
 *
 * Quick update's Confirm is exactly that: every value in it is the user's word
 * on what the balance is today, including one they deliberately typed back to
 * the stored figure. Everywhere else nothing is explicit — the editors submit
 * the whole list, so "same as stored" is the only available reading of
 * "untouched".
 */
export interface ExplicitBalances {
  cash?: boolean
  investmentIds?: ReadonlySet<string>
}

/**
 * The value a balance has today, when the edit left it at the stored one and
 * did not state it outright. A balance the edit changed — or confirmed — is the
 * user's word on what it is now, and stands exactly as given.
 */
function carried(
  next: number | undefined,
  stored: number | undefined,
  current: number | undefined,
  explicit = false,
): number | undefined {
  if (explicit) return next
  return next === stored ? current : next
}

/**
 * `next` with every balance the edit left untouched replaced by the value it
 * has grown, accrued or amortized to today.
 *
 * Saving a balance re-dates the snapshot baseline, and the editors hand back
 * whole lists rebuilt from the *stored* values — so without this, changing one
 * investment would stamp every other balance's months-old figure as
 * confirmed-today and give back all the drift since. Matched by id: an item the
 * profile did not hold before has no history to carry forward.
 *
 * Loans carry their remaining term along with the balance, so the elapsed
 * installments do not get paid a second time later.
 *
 * Tangible asset values are left alone, as they are everywhere else — only the
 * debt secured against them moves on its own.
 */
export function withBalancesCarriedForward(
  stored: Profile,
  next: Profile,
  today: Date,
  explicit: ExplicitBalances = {},
): Profile {
  const current = getCurrentProfile(stored, today)
  // Nothing has elapsed since the last snapshot, so nothing to carry.
  if (current === stored) return next

  const investmentBalance = (i: { balance: number }) => i.balance
  const loanBalance = (l: { outstanding_balance?: number }) => l.outstanding_balance
  const loanTerm = (l: { remaining_term?: number }) => l.remaining_term
  const index = {
    storedInvestments: fieldIndex(stored.investments, investmentBalance),
    currentInvestments: fieldIndex(current.investments, investmentBalance),
    storedLiabilities: fieldIndex(stored.liabilities, loanBalance),
    currentLiabilities: fieldIndex(current.liabilities, loanBalance),
    storedLiabilityTerms: fieldIndex(stored.liabilities, loanTerm),
    currentLiabilityTerms: fieldIndex(current.liabilities, loanTerm),
    storedAssets: fieldIndex(stored.tangible_assets, loanBalance),
    currentAssets: fieldIndex(current.tangible_assets, loanBalance),
    storedAssetTerms: fieldIndex(stored.tangible_assets, loanTerm),
    currentAssetTerms: fieldIndex(current.tangible_assets, loanTerm),
  }

  return {
    ...next,
    cash_amount: carried(next.cash_amount, stored.cash_amount, current.cash_amount, explicit.cash),
    investments: next.investments?.map((investment) => ({
      ...investment,
      balance:
        carried(
          investment.balance,
          index.storedInvestments.get(investment.id),
          index.currentInvestments.get(investment.id),
          explicit.investmentIds?.has(investment.id),
        ) ?? investment.balance,
    })),
    // Loans are never confirmed in Quick update — they amortize on their own
    // terms, so they always arrive here carried forward by the fresh clock.
    liabilities: next.liabilities?.map((liability) => ({
      ...liability,
      outstanding_balance:
        carried(
          liability.outstanding_balance,
          index.storedLiabilities.get(liability.id),
          index.currentLiabilities.get(liability.id),
        ) ?? liability.outstanding_balance,
      remaining_term:
        carried(
          liability.remaining_term,
          index.storedLiabilityTerms.get(liability.id),
          index.currentLiabilityTerms.get(liability.id),
        ) ?? liability.remaining_term,
    })),
    tangible_assets: next.tangible_assets?.map((asset) => ({
      ...asset,
      outstanding_balance: carried(
        asset.outstanding_balance,
        index.storedAssets.get(asset.id),
        index.currentAssets.get(asset.id),
      ),
      remaining_term: carried(
        asset.remaining_term,
        index.storedAssetTerms.get(asset.id),
        index.currentAssetTerms.get(asset.id),
      ),
    })),
  }
}

/**
 * Change from `previous` to `current` as a percentage, or undefined when there
 * is no baseline to compare against.
 *
 * Measured against the *size* of the baseline, so the sign of the result is
 * the direction the figure moved rather than the direction it moved relative
 * to which side of zero it started on. Dividing by a signed baseline would
 * report a debt shrinking from −1,000 to −500 as −50% and colour a repayment
 * as a loss.
 */
export function percentChange(previous: number, current: number): number | undefined {
  if (previous === 0) return undefined
  return ((current - previous) / Math.abs(previous)) * 100
}
