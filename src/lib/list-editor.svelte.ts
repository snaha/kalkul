import { z } from 'zod'

export interface ListEditorItem {
  id: string
  name: string
  editing: boolean
}

export interface ListEditorConfig<TStored, TUI extends ListEditorItem> {
  /** Current stored items (the profile is loaded before render, see +layout.ts). */
  load: () => TStored[] | undefined
  /** Map one stored item into its editable UI shape. */
  toUI: (stored: TStored) => TUI
  /** Fresh UI item for the Add button; `index` is 1-based for default names. */
  makeBlank: (index: number) => TUI
  /** Localized copy name for duplicated items. */
  copyName: (name: string) => string
  /** Whether the item carries a meaningful value (drives hasAnyValue). */
  hasValue: (item: TUI) => boolean
  /** Map one UI item back to its stored shape. */
  toStored: (item: TUI) => TStored
  /** Persist the mapped items — usually a single appStore.updateProfile call. */
  persist: (items: TStored[]) => void
}

export interface ListEditor<TUI extends ListEditorItem> {
  readonly items: TUI[]
  readonly hasAnyValue: boolean
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
export function createListEditor<TStored, TUI extends ListEditorItem>(
  config: ListEditorConfig<TStored, TUI>,
): ListEditor<TUI> {
  const initial = (config.load() ?? []).map(config.toUI)
  const items = $state<TUI[]>(initial)
  let counter = $state(initial.length)
  let errors = $state<Record<string, string[]>>({})

  /** Returns whether the write actually landed, so callers can retry later. */
  function save(): boolean {
    const persisted = items.filter((item) => item.name.trim().length > 0 || config.hasValue(item))
    try {
      config.persist(persisted.map(config.toStored))
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
    get hasAnyValue() {
      return items.some(config.hasValue)
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
      items.splice(idx + 1, 0, {
        ...item,
        id: crypto.randomUUID(),
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
