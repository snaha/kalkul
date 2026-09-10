import { getCurrentProfile } from '$lib/current-values'
import { type Frequency, type Profile, type Snapshot, normalizeSnapshots } from '$lib/schemas'
import { byId, captureSnapshot, heldProfile, profileAtSnapshot } from '$lib/snapshots'
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
 * it. An item held on the date but never recorded opens at zero (it may have
 * existed, and the user can say otherwise); an entry recorded for an item the
 * profile has since deleted gets no field, and `snapshotFromFields` carries it
 * through untouched rather than dropping it.
 */
export function buildSnapshotSections(
  profile: Profile,
  source: Snapshot,
  date: string,
): SnapshotSection[] {
  const held = heldProfile(profile, parseDateOnly(date))
  const recordedInvestments = byId(source.investments)
  const recordedAssets = byId(source.tangible_assets)
  const recordedLiabilities = byId(source.liabilities)

  // Incomes and expenses are the same shape and the same rules; one section
  // builder covers both. An amount the snapshot has no entry for opens at zero,
  // like every other figure — snapshots stored before cash flows were recorded
  // are filled in from the profile at the load boundary (`repairStoredData`).
  const cashFlowSection = (id: 'incomes' | 'expenses'): SnapshotSection => {
    const recorded = byId(source[id])
    return {
      id,
      fields: (profile[id] ?? []).map((flow) => {
        const entry = recorded.get(flow.id)
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
    const recorded = recordedAssets.get(asset.id)
    const value: SnapshotField = {
      key: `tangible_assets:${asset.id}`,
      itemId: asset.id,
      label: asset.name,
      kind: 'value',
      value: recorded?.value ?? 0,
    }
    // A snapshot that recorded debt keeps its field even once the asset is paid
    // off, so the figure stays the user's to correct instead of disappearing on
    // the next confirm.
    const financed = asset.status === 'financed' || recorded?.outstanding_balance !== undefined
    if (!financed) return [value]
    return [
      value,
      {
        key: `tangible_assets:${asset.id}:debt`,
        itemId: asset.id,
        label: asset.name,
        kind: 'debt',
        value: recorded?.outstanding_balance ?? 0,
      },
    ]
  })

  return [
    {
      id: 'cash',
      fields: [
        { key: 'cash', itemId: 'cash', label: '', kind: 'cash', value: source.cash_amount ?? 0 },
      ],
    },
    {
      id: 'investments',
      fields: (held.investments ?? []).map((investment) => ({
        key: `investments:${investment.id}`,
        itemId: investment.id,
        label: investment.name,
        kind: 'balance',
        value: recordedInvestments.get(investment.id)?.balance ?? 0,
      })),
    },
    { id: 'tangible_assets', fields: tangibleFields },
    {
      id: 'liabilities',
      fields: (profile.liabilities ?? []).map((liability) => ({
        key: `liabilities:${liability.id}`,
        itemId: liability.id,
        label: liability.name,
        kind: 'debt',
        value: recordedLiabilities.get(liability.id)?.outstanding_balance ?? 0,
      })),
    },
    cashFlowSection('incomes'),
    cashFlowSection('expenses'),
  ]
}

/** Entries the dialog wrote, followed by the ones from `base` it never covered. */
function merged<T extends { id: string }>(base: T[] | undefined, written: T[]): T[] {
  const covered = new Set(written.map((entry) => entry.id))
  return [...written, ...(base ?? []).filter((entry) => !covered.has(entry.id))]
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

  // The dialog edits no loan terms — the design draws none — but a snapshot
  // records them alongside the balance, so the recorded term rides through a
  // save. Dropping it would restart the loan's clock the next time the profile
  // is re-baselined onto this snapshot.
  const baseAssets = byId(base.tangible_assets)
  const baseLiabilities = byId(base.liabilities)

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
        remaining_term: debt ? baseAssets.get(field.itemId)?.remaining_term : undefined,
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

  return {
    date,
    cash_amount: cashField ? valueOf(cashField) : base.cash_amount,
    investments: merged(
      base.investments,
      fieldsOf('investments').map((field) => ({ id: field.itemId, balance: valueOf(field) })),
    ),
    tangible_assets: merged(base.tangible_assets, tangible),
    liabilities: merged(
      base.liabilities,
      fieldsOf('liabilities').map((field) => ({
        id: field.itemId,
        outstanding_balance: valueOf(field),
        remaining_term: baseLiabilities.get(field.itemId)?.remaining_term,
      })),
    ),
    incomes: merged(base.incomes, cashFlows('incomes')),
    expenses: merged(base.expenses, cashFlows('expenses')),
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
 */
export function seedSnapshotOn(profile: Profile, date: string): Snapshot {
  const snapshots = normalizeSnapshots(profile.snapshots ?? [])
  const base = snapshots.findLast((snapshot) => snapshot.date <= date) ?? snapshots[0]
  if (!base) return captureSnapshot(profile, date)
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
