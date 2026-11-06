import type { ExplicitBalances } from '$lib/current-values'
import type { Profile } from '$lib/schemas'

interface ConfirmedBalances {
  updates: Partial<Profile>
  entered: ExplicitBalances
}

/**
 * What Quick update's Confirm persists: the cash and investment figures the user
 * typed, and which ones those are. A figure left out is estimated by the store
 * and recorded as unknown.
 *
 * Built from the stored investments because the list is submitted whole and
 * replaces what is there.
 */
export function buildConfirmUpdates(
  stored: Profile,
  cashAmount: number | undefined,
  investmentBalances: ReadonlyMap<string, number>,
): ConfirmedBalances {
  return {
    updates: {
      ...(cashAmount === undefined ? {} : { cash_amount: cashAmount }),
      investments: (stored.investments ?? []).map((investment) => ({
        ...investment,
        balance: investmentBalances.get(investment.id) ?? investment.balance,
      })),
    },
    entered: {
      cash: cashAmount !== undefined,
      investmentIds: new Set(investmentBalances.keys()),
    },
  }
}
