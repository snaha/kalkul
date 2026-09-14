import { getCurrentProfile } from '$lib/current-values'
import {
  type Frequency,
  type Profile,
  type RemainingTermUnit,
  type Snapshot,
  normalizeSnapshots,
} from '$lib/schemas'
import {
  byId,
  captureSnapshot,
  heldProfile,
  profileAtSnapshot,
  recordsDebt,
  withMissingEntries,
} from '$lib/snapshots'
import { parseDateOnly } from '$lib/utils'

/** The six groups the snapshot dialog is laid out in, in the design's order. */
export type SnapshotSectionId =
  | 'cash'
  | 'investments'
  | 'tangible_assets'
  | 'liabilities'
  | 'incomes'
  | 'expenses'

/** What a field holds, which decides its label wording and its sign. */
export type SnapshotFieldKind = 'cash' | 'balance' | 'value' | 'debt' | 'amount'

export interface SnapshotField {
  /** Unique across the dialog; also the key edits are stored under. */
  key: string
  /** Id of the profile item this field records a figure for. */
  itemId: string
  /** The item's name. Empty for cash, which the section heading names. */
  label: string
  kind: SnapshotFieldKind
  /**
   * Carried through untouched for a cash flow. The dialog edits amounts only —
   * the design draws no frequency control — but a snapshot records both, so the
   * frequency has to survive the round trip.
   */
  frequency?: Frequency
  /**
   * Carried through untouched for a debt, the same way: the design draws no
   * term control, but a snapshot records the term beside the balance, and
   * restoring the one without the other would restart the loan's clock.
   */
  remaining_term?: number
  remaining_term_unit?: RemainingTermUnit
  /** Figure the field opens with, and what it falls back to when cleared. */
  value: number
}

export interface SnapshotSection {
  id: SnapshotSectionId
  fields: SnapshotField[]
}

/**
 * The dialog's fields for editing `source` on `date`, one per figure the
 * snapshot can record.
 *
 * The *profile* decides which items appear — those are the ones the user can
 * name and reason about — while `source` supplies the figures. Only what the
 * profile holds on `date` is offered: every field is written back into the
 * snapshot, and the newest snapshot is overlaid onto the profile, so a field
 * for a position that only starts in 2030 would let an untouched Confirm zero
 * it. An entry recorded for an item the profile has since deleted gets no
 * field, and `snapshotFromFields` carries it through untouched rather than
 * dropping it.
 *
 * A figure `source` never recorded opens at the app's estimate for `date`
 * (`seedSnapshotOn`) rather than at zero. For a snapshot moved past the newest
 * one — a Duplicate, or a re-dated row — that is the item carried forward from
 * the profile: the copy becomes the baseline, and a zero would wipe a holding
 * opened since on an untouched Confirm. On an older snapshot's own date the
 * estimate is that snapshot itself, so an item it never recorded still opens
 * at zero — it did not exist yet as far as the history knows.
 *
 * Cash flows make one exception, on the newest snapshot's own date. They are
 * history rather than baseline — the profile's may have moved on since without
 * recording anything — so there the estimate, which runs on the profile's
 * flows, would put today's onto that day. A flow opens at what the history
 * recorded for the date whenever it has a snapshot for it.
 */
export function buildSnapshotSections(
  profile: Profile,
  source: Snapshot,
  date: string,
): SnapshotSection[] {
  const held = heldProfile(profile, parseDateOnly(date))
  const estimate = seedSnapshotOn(profile, date)
  // Where a cash flow `source` never recorded is read from: see the exception above.
  const flowFallback =
    (profile.snapshots ?? []).find((snapshot) => snapshot.date === date) ?? estimate

  /** An item's entry in `source`, or in the estimate when `source` has none. */
  const lookup = <T extends { id: string }>(
    recorded: T[] | undefined,
    estimated: T[] | undefined,
  ) => {
    const inSource = byId(recorded)
    const inEstimate = byId(estimated)
    return (id: string) => inSource.get(id) ?? inEstimate.get(id)
  }
  const investmentEntry = lookup(source.investments, estimate.investments)
  const assetEntry = lookup(source.tangible_assets, estimate.tangible_assets)
  const liabilityEntry = lookup(source.liabilities, estimate.liabilities)

  // Incomes and expenses are the same shape and the same rules; one section
  // builder covers both.
  const cashFlowSection = (id: 'incomes' | 'expenses'): SnapshotSection => {
    const entryOf = lookup(source[id], flowFallback[id])
    return {
      id,
      fields: (profile[id] ?? []).map((flow) => {
        const entry = entryOf(flow.id)
        return {
          key: `${id}:${flow.id}`,
          itemId: flow.id,
          label: flow.name,
          kind: 'amount' as const,
          frequency: entry?.frequency ?? flow.frequency,
          value: entry?.amount ?? 0,
        }
      }),
    }
  }

  const tangibleFields = (held.tangible_assets ?? []).flatMap((asset): SnapshotField[] => {
    const entry = assetEntry(asset.id)
    const value: SnapshotField = {
      key: `tangible_assets:${asset.id}`,
      itemId: asset.id,
      label: asset.name,
      kind: 'value',
      value: entry?.value ?? 0,
    }
    // A snapshot that recorded debt keeps its field even once the asset is paid
    // off, so the figure stays the user's to correct instead of disappearing on
    // the next confirm.
    const financed = asset.status === 'financed' || (entry !== undefined && recordsDebt(entry))
    if (!financed) return [value]
    return [
      value,
      {
        key: `tangible_assets:${asset.id}:debt`,
        itemId: asset.id,
        label: asset.name,
        kind: 'debt',
        remaining_term: entry?.remaining_term,
        remaining_term_unit: entry?.remaining_term_unit,
        value: entry?.outstanding_balance ?? 0,
      },
    ]
  })

  return [
    {
      id: 'cash',
      fields: [
        {
          key: 'cash',
          itemId: 'cash',
          label: '',
          kind: 'cash',
          value: source.cash_amount ?? estimate.cash_amount ?? 0,
        },
      ],
    },
    {
      id: 'investments',
      fields: (held.investments ?? []).map((investment) => ({
        key: `investments:${investment.id}`,
        itemId: investment.id,
        label: investment.name,
        kind: 'balance',
        value: investmentEntry(investment.id)?.balance ?? 0,
      })),
    },
    { id: 'tangible_assets', fields: tangibleFields },
    {
      id: 'liabilities',
      fields: (profile.liabilities ?? []).map((liability) => {
        const entry = liabilityEntry(liability.id)
        return {
          key: `liabilities:${liability.id}`,
          itemId: liability.id,
          label: liability.name,
          kind: 'debt',
          remaining_term: entry?.remaining_term,
          remaining_term_unit: entry?.remaining_term_unit,
          value: entry?.outstanding_balance ?? 0,
        }
      }),
    },
    cashFlowSection('incomes'),
    cashFlowSection('expenses'),
  ]
}

/**
 * The snapshot the dialog would save: `base` with every field's figure written
 * back under `date`.
 *
 * `edits` holds only what the user typed, keyed by field key. A key that is
 * missing or cleared falls back to the field's seeded value — an empty box
 * means "I have not said", the same convention Quick update uses. Recording a
 * balance of zero therefore takes a typed `0`; clearing the box does not do it.
 */
export function snapshotFromFields(
  base: Snapshot,
  sections: SnapshotSection[],
  edits: Record<string, number | undefined>,
  date: string,
): Snapshot {
  const fieldsOf = (id: SnapshotSectionId) =>
    sections.find((section) => section.id === id)?.fields ?? []
  const valueOf = (field: SnapshotField) => edits[field.key] ?? field.value

  // The dialog edits no loan terms — the design draws none — so each debt is
  // written back with the term its field carried, which is the one recorded
  // beside the figure it opened at. Dropping it would restart the loan's clock
  // the next time the profile is re-baselined onto this snapshot.
  const tangibleFields = fieldsOf('tangible_assets')
  const tangible = tangibleFields
    .filter((field) => field.kind === 'value')
    .map((field) => {
      const debt = tangibleFields.find(
        (other) => other.itemId === field.itemId && other.kind === 'debt',
      )
      return {
        id: field.itemId,
        value: valueOf(field),
        outstanding_balance: debt ? valueOf(debt) : undefined,
        remaining_term: debt?.remaining_term,
        remaining_term_unit: debt?.remaining_term_unit,
      }
    })

  const cashFlows = (id: 'incomes' | 'expenses') =>
    fieldsOf(id).map((field) => ({
      id: field.itemId,
      amount: valueOf(field),
      // Every cash-flow field carries one; the fallback only satisfies the type.
      frequency: field.frequency ?? 'monthly',
    }))

  const cashField = fieldsOf('cash')[0]

  // Entries the dialog wrote, followed by the ones from `base` it never covered.
  return {
    date,
    cash_amount: cashField ? valueOf(cashField) : base.cash_amount,
    investments: withMissingEntries(
      fieldsOf('investments').map((field) => ({ id: field.itemId, balance: valueOf(field) })),
      base.investments,
    ),
    tangible_assets: withMissingEntries(tangible, base.tangible_assets),
    liabilities: withMissingEntries(
      fieldsOf('liabilities').map((field) => ({
        id: field.itemId,
        outstanding_balance: valueOf(field),
        remaining_term: field.remaining_term,
        remaining_term_unit: field.remaining_term_unit,
      })),
      base.liabilities,
    ),
    incomes: withMissingEntries(cashFlows('incomes'), base.incomes),
    expenses: withMissingEntries(cashFlows('expenses'), base.expenses),
  }
}

/**
 * The figures a fresh snapshot opens at for `date`: the app's own estimate of
 * how the finances stood that day, so the user corrects a plausible starting
 * point instead of retyping everything.
 *
 * The newest snapshot on or before the date is carried forward to it, by the
 * same model the dashboard carries the latest one to today. An item that
 * snapshot never recorded is left out, so it opens at zero — it did not exist
 * yet. A date before the first snapshot opens at that snapshot's figures, there
 * being nothing earlier to wind back from; a profile with no history opens at
 * its own.
 *
 * On or after the newest snapshot the profile itself is the baseline: it holds
 * that snapshot's balances by construction, and — unlike the snapshot — the
 * cash flows running now, which may have changed since without recording
 * anything. That is exactly what the dashboard projects from, so the seed
 * agrees with the figures the user sees there.
 */
export function seedSnapshotOn(profile: Profile, date: string): Snapshot {
  const snapshots = normalizeSnapshots(profile.snapshots ?? [])
  const latest = snapshots.at(-1)
  if (!latest || date >= latest.date) {
    return captureSnapshot(getCurrentProfile(profile, parseDateOnly(date)), date)
  }
  const base = snapshots.findLast((snapshot) => snapshot.date <= date) ?? snapshots[0]
  const asOfBase: Profile = { ...profileAtSnapshot(profile, base), snapshots: [base] }
  return captureSnapshot(getCurrentProfile(asOfBase, parseDateOnly(date)), date)
}

/**
 * The date the dialog opens with. A seeded date that already has a snapshot —
 * today, when the user confirmed one earlier today — opens the field blank and
 * asks for a date, rather than opening on an error the user did nothing to
 * cause. A snapshot being edited keeps its own date, taken or not.
 */
export function openingDate(seeded: string, takenDates: string[], originalDate?: string): string {
  if (seeded === originalDate) return seeded
  return takenDates.includes(seeded) ? '' : seeded
}
