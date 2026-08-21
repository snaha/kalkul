import type { Frequency, Profile, Snapshot } from '$lib/schemas'

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

const entryById = <T extends { id: string }>(entries: T[] | undefined, id: string) =>
  (entries ?? []).find((entry) => entry.id === id)

/**
 * What a cash-flow field opens at. A snapshot written before cash flows were
 * recorded leaves the whole list undefined; opening at zero would invite the
 * user to confirm an income they were in fact earning, so the profile's current
 * amount stands in. An entry missing from a list that *was* recorded is a
 * recorded fact — the flow did not exist yet — and opens at zero.
 */
function cashFlowAmount(
  recorded: { id: string; amount: number }[] | undefined,
  item: { id: string; amount: number },
): number {
  if (!recorded) return item.amount
  return entryById(recorded, item.id)?.amount ?? 0
}

/**
 * The dialog's fields for editing `source`, one per figure the snapshot can
 * record.
 *
 * The *profile* decides which items appear — those are the ones the user can
 * name and reason about — while `source` supplies the figures. An item the
 * snapshot never recorded opens at zero (it did not exist on that date, and the
 * user can say otherwise); an entry recorded for an item the profile has since
 * deleted gets no field, and `snapshotFromFields` carries it through untouched
 * rather than dropping it.
 */
export function buildSnapshotSections(profile: Profile, source: Snapshot): SnapshotSection[] {
  const tangibleFields = (profile.tangible_assets ?? []).flatMap((asset): SnapshotField[] => {
    const recorded = entryById(source.tangible_assets, asset.id)
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
      fields: (profile.investments ?? []).map((investment) => ({
        key: `investments:${investment.id}`,
        itemId: investment.id,
        label: investment.name,
        kind: 'balance',
        value: entryById(source.investments, investment.id)?.balance ?? 0,
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
        value: entryById(source.liabilities, liability.id)?.outstanding_balance ?? 0,
      })),
    },
    {
      id: 'incomes',
      fields: (profile.incomes ?? []).map((income) => ({
        key: `incomes:${income.id}`,
        itemId: income.id,
        label: income.name,
        kind: 'amount',
        frequency: entryById(source.incomes, income.id)?.frequency ?? income.frequency,
        value: cashFlowAmount(source.incomes, income),
      })),
    },
    {
      id: 'expenses',
      fields: (profile.expenses ?? []).map((expense) => ({
        key: `expenses:${expense.id}`,
        itemId: expense.id,
        label: expense.name,
        kind: 'amount',
        frequency: entryById(source.expenses, expense.id)?.frequency ?? expense.frequency,
        value: cashFlowAmount(source.expenses, expense),
      })),
    },
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
 * means "I have not said", the same convention Quick update uses. Confirming a
 * zero is still possible by typing one.
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
      }
    })

  const cashFlow = (id: 'incomes' | 'expenses') =>
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
      })),
    ),
    incomes: merged(base.incomes, cashFlow('incomes')),
    expenses: merged(base.expenses, cashFlow('expenses')),
  }
}
