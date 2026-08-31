import { z } from 'zod'

export interface ListEditorItem {
  id: string
  name: string
  editing: boolean
}

export interface ListEditorConfig<TStored extends { id: string }, TUI extends ListEditorItem> {
  /** Current stored items (the profile is loaded before render, see +layout.ts). */
  load: () => TStored[] | undefined
  /** Map one stored item into its editable UI shape. */
  toUI: (stored: TStored) => TUI
  /** Fresh UI item for the Add button; `index` is 1-based for default names. */
  makeBlank: (index: number) => TUI
  /** Localized copy name for duplicated items. */
  copyName: (name: string) => string
  /** Whether the item carries a meaningful value (gates persistence of the seeded blank). */
  hasValue: (item: TUI) => boolean
  /**
   * Map one UI item back to its stored shape. `stored` is the item as it was
   * loaded (or the source item for a duplicate), so an editor can spread it
   * and only override the fields its card actually renders — otherwise every
   * save would wipe the fields that live in the plan dialogs.
   */
  toStored: (item: TUI, stored: TStored | undefined) => TStored
  /** Persist the mapped items — usually a single appStore.updateProfile call. */
  persist: (items: TStored[]) => void
}

export interface ListEditor<TUI extends ListEditorItem> {
  readonly items: TUI[]
  /** Localized validation messages per item id from the last failed save. */
  readonly errors: Record<string, string[]>
  add(): void
  duplicate(item: TUI): void
  remove(item: TUI): void
  /** Cancel the pending debounce and save now. Call from onDestroy. */
  flushSave(): void
}

/**
 * Shared state + persistence scaffolding for the five profile list editors
 * (investments, tangible assets, liabilities, incomes, expenses). Owns the
 * item list, add/duplicate/remove, and the debounced autosave, so the fix for
 * any of those lives in one place. The category-specific parts — UI shape,
 * stored mapping, blank defaults, markup — stay in the editor components.
 *
 * Must be called during component initialization (it registers an autosave
 * `$effect`); pair it with `onDestroy(editor.flushSave)` in the component so
 * pending edits are saved on navigation.
 */
export function createListEditor<TStored extends { id: string }, TUI extends ListEditorItem>(
  config: ListEditorConfig<TStored, TUI>,
): ListEditor<TUI> {
  const stored = config.load() ?? []
  // An empty list opens with one expanded card so the user can start typing
  // without pressing "Add" first. It stays out of the profile until it has a
  // value — see the `placeholderId` check in save().
  const initial = stored.length > 0 ? stored.map(config.toUI) : [config.makeBlank(1)]
  // Stored shape by id, so toStored can carry through the fields no card
  // renders (a transfer's schedule, a tangible asset's planned purchase).
  // A plain record rather than a Map: nothing reads it reactively.
  const originals: Record<string, TStored> = Object.fromEntries(
    stored.map((item) => [item.id, item]),
  )
  const placeholderId = stored.length > 0 ? undefined : initial[0].id
  // The seeded card only stays out of the profile while it is untouched:
  // naming it is enough to make it worth keeping across a remount.
  const placeholderName = placeholderId === undefined ? undefined : initial[0].name
  const items = $state<TUI[]>(initial)
  let counter = $state(initial.length)
  let errors = $state<Record<string, string[]>>({})

  /** Returns whether the write actually landed, so callers can retry later. */
  function save(): boolean {
    const persisted = items.filter(
      (item) =>
        (item.id !== placeholderId || config.hasValue(item) || item.name !== placeholderName) &&
        (item.name.trim().length > 0 || config.hasValue(item)),
    )
    try {
      config.persist(persisted.map((item) => config.toStored(item, originals[item.id])))
      errors = {}
      return true
    } catch (e) {
      if (e instanceof z.ZodError) {
        // The write was rejected as a whole and nothing was persisted. Show
        // the localized schema messages next to the items that caused them:
        // issue paths look like ['incomes', <index into persisted>, <field>].
        const next: Record<string, string[]> = {}
        for (const issue of e.issues) {
          const index = issue.path[1]
          const item = typeof index === 'number' ? persisted[index] : undefined
          if (!item) continue
          const messages = (next[item.id] ??= [])
          if (!messages.includes(issue.message)) messages.push(issue.message)
        }
        errors = next
      } else {
        console.error('Failed to save editor changes', e)
      }
      return false
    }
  }

  // Auto-save on any edit, debounced so rapid typing does one schema-parse +
  // localStorage write instead of one per keystroke. Skip the first (mount)
  // run so merely viewing the page doesn't rewrite the profile (and bump
  // "last updated") without a real change.
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  // Set when an edit schedules a save, cleared once that save runs. Without it
  // `onDestroy(editor.flushSave)` would persist on a page the user only
  // viewed, rewriting the profile and bumping "last updated" with no actual
  // change — the same thing the mount skip below exists to prevent.
  let pendingSave = false
  function flushSave(): void {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (!pendingSave) return
    // Stay pending when the write was rejected, so the onDestroy flush still
    // gets a chance to persist edits that a transient failure held back.
    if (save()) pendingSave = false
  }
  let autoSaveArmed = false
  $effect(() => {
    $state.snapshot(items) // track every field so edits re-run this effect
    if (!autoSaveArmed) {
      autoSaveArmed = true
      return
    }
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    pendingSave = true
    saveTimer = setTimeout(flushSave, 300)
  })

  return {
    get items() {
      return items
    },
    get errors() {
      return errors
    },
    add() {
      counter++
      for (const item of items) item.editing = false
      items.push(config.makeBlank(counter))
    },
    duplicate(item: TUI) {
      // Guard like remove() does: a stale item reference would otherwise make
      // splice(-1 + 1, ...) insert the copy at the head of the list.
      const idx = items.indexOf(item)
      if (idx === -1) return
      counter++
      const id = crypto.randomUUID()
      // Carry the source's stored shape too, so the copy keeps the fields the
      // card does not render instead of falling back to the blank defaults.
      const source = originals[item.id]
      if (source !== undefined) originals[id] = { ...source, id }
      items.splice(idx + 1, 0, {
        ...item,
        id,
        name: config.copyName(item.name),
        editing: true,
      })
    },
    remove(item: TUI) {
      const idx = items.indexOf(item)
      if (idx !== -1) items.splice(idx, 1)
    },
    flushSave,
  }
}
