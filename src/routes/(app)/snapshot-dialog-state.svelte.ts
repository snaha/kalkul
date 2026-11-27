import type { Profile, Snapshot } from '$lib/schemas'
import { seedSnapshotOn } from '$lib/snapshot-form'

/**
 * What the snapshot dialog is open on, and the ways to open it. The dashboard's
 * History section and the History page share it, so a dot on either chart and
 * a row of the table open the same dialog the same way.
 */
export function snapshotDialogState(profile: () => Profile, today: () => string) {
  let open = $state(false)
  let mode = $state<'add' | 'edit'>('add')
  // Placeholder until one of the openers below fills it in.
  let source = $state<Snapshot>({ date: '' })
  let originalDate = $state<string | undefined>(undefined)
  let seedOn = $state<((date: string) => Snapshot) | undefined>(undefined)

  const snapshotOn = (date: string) =>
    (profile().snapshots ?? []).find((snapshot) => snapshot.date === date)

  return {
    get open() {
      return open
    },
    set open(value: boolean) {
      open = value
    },
    get mode() {
      return mode
    },
    get source() {
      return source
    },
    /** Date the edited snapshot sits at; undefined for a new one. */
    get originalDate() {
      return originalDate
    },
    get seedOn() {
      return seedOn
    },
    /** Every date already recorded. */
    get takenDates() {
      return (profile().snapshots ?? []).map((snapshot) => snapshot.date)
    },

    /**
     * A new snapshot for today, seeded with the app's own estimate for the
     * date (the figures Quick update starts from) and re-seeded when the user
     * picks another day. A blank form would ask them to retype everything
     * they already told the app.
     */
    openAdd(): void {
      const stored = profile()
      const seed = (date: string) => seedSnapshotOn(stored, date)
      mode = 'add'
      source = seed(today())
      seedOn = seed
      originalDate = undefined
      open = true
    },

    /** The snapshot recorded on `date`, to correct. */
    openEdit(date: string): void {
      const snapshot = snapshotOn(date)
      if (!snapshot) return
      mode = 'edit'
      source = snapshot
      seedOn = undefined
      originalDate = date
      open = true
    },

    /**
     * A copy of the snapshot recorded on `date`. A copy is a new snapshot, so
     * it starts at today and leaves the original where it is; the user
     * re-dates it if they meant another day. It keeps the copied figures,
     * unknown ones as unknown, and is not re-seeded.
     */
    openDuplicate(date: string): void {
      const snapshot = snapshotOn(date)
      if (!snapshot) return
      mode = 'add'
      source = { ...snapshot, date: today() }
      seedOn = undefined
      originalDate = undefined
      open = true
    },
  }
}
