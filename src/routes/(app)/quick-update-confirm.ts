import type { Profile } from '$lib/schemas'

/**
 * The profile updates Quick update's Confirm persists: the cash and investment
 * values the user saw (edited or suggested), plus the projected balances for
 * the items the dialog does not ask about. Loan balances amortize on their own
 * terms, so leaving them at the stored values would record a today-snapshot
 * carrying months-old debt — and make net worth jump the moment the
 * confirmation lands, since the dashboard was showing the amortized figures
 * right up to the click.
 */
export function buildConfirmUpdates(
  projectedProfile: Profile,
  cashAmount: number,
  investmentBalances: ReadonlyMap<string, number>,
): Partial<Profile> {
  return {
    cash_amount: cashAmount,
    investments: (projectedProfile.investments ?? []).map((investment) => ({
      ...investment,
      balance: investmentBalances.get(investment.id) ?? investment.balance,
    })),
    tangible_assets: projectedProfile.tangible_assets,
    liabilities: projectedProfile.liabilities,
  }
}
