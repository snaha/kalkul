import type { Profile } from '$lib/schemas'

/**
 * The profile updates Quick update's Confirm persists: the cash and investment
 * values the user saw (edited or suggested), and nothing else.
 *
 * Only what the dialog actually asks about is submitted. Loan balances amortize
 * on their own terms, and the store carries them forward against the clock it
 * reads when the confirmation lands — submitting the page's projected figures
 * would record balances computed from a clock read when the dashboard rendered,
 * as though the user had typed them.
 *
 * The values that are submitted are confirmations: the store persists them
 * verbatim, including one the user typed back to its stored figure.
 *
 * Built from the *stored* investments rather than the rows, because the list is
 * submitted whole and replaces what is there. The dialog asks only about what
 * the user holds today, so a position bought in a future year has no row —
 * taking the list from the rows would delete it, and taking a balance from
 * anywhere but the map would rewrite the amount the plan is going to buy.
 */
export function buildConfirmUpdates(
  stored: Profile,
  cashAmount: number,
  investmentBalances: ReadonlyMap<string, number>,
): Partial<Profile> {
  return {
    cash_amount: cashAmount,
    investments: (stored.investments ?? []).map((investment) => ({
      ...investment,
      balance: investmentBalances.get(investment.id) ?? investment.balance,
    })),
  }
}
