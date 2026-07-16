// @vitest-environment happy-dom
// The default node environment transforms modules in SSR mode, where the
// Svelte compiler replaces $effect.root with a no-op — a DOM environment
// switches this file to web transforms so the client runtime (real effects)
// is exercised.
import { flushSync } from 'svelte'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { type ListEditor, createListEditor } from './list-editor.svelte'

interface StoredThing {
  id: string
  name: string
  value: number
}

interface ThingUI {
  id: string
  name: string
  value: number | undefined
  editing: boolean
}

function setup(options?: { initial?: StoredThing[]; persist?: (items: StoredThing[]) => void }): {
  editor: ListEditor<ThingUI>
  persisted: StoredThing[][]
  cleanup: () => void
} {
  const persisted: StoredThing[][] = []
  let editor!: ListEditor<ThingUI>
  // $effect.root provides the effect context the factory's autosave $effect
  // needs outside a component.
  const cleanup = $effect.root(() => {
    editor = createListEditor<StoredThing, ThingUI>({
      load: () => options?.initial ?? [],
      toUI: (s) => ({
        id: s.id,
        name: s.name,
        value: s.value > 0 ? s.value : undefined,
        editing: false,
      }),
      makeBlank: (index) => ({
        id: `new-${index}`,
        name: `Item ${index}`,
        value: undefined,
        editing: true,
      }),
      copyName: (name) => `${name} copy`,
      hasValue: (i) => (i.value ?? 0) > 0,
      toStored: (i) => ({ id: i.id, name: i.name, value: i.value ?? 0 }),
      persist: options?.persist ?? ((items) => persisted.push(items)),
    })
  })
  flushSync()
  return { editor, persisted, cleanup }
}

const one: StoredThing = { id: 'a', name: 'Existing', value: 10 }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createListEditor', () => {
  it('seeds items from load() through toUI()', () => {
    const { editor, cleanup } = setup({ initial: [one] })
    expect(editor.items).toEqual([{ id: 'a', name: 'Existing', value: 10, editing: false }])
    cleanup()
  })

  it('does not persist on mount — merely viewing must not rewrite the profile', () => {
    const { persisted, cleanup } = setup({ initial: [one] })
    vi.advanceTimersByTime(1000)
    expect(persisted).toEqual([])
    cleanup()
  })

  it('debounces edits into a single persist with the mapped stored shape', () => {
    const { editor, persisted, cleanup } = setup({ initial: [one] })
    editor.items[0].value = 42
    flushSync()
    editor.items[0].value = 43
    flushSync()
    expect(persisted).toEqual([])
    vi.advanceTimersByTime(300)
    expect(persisted).toEqual([[{ id: 'a', name: 'Existing', value: 43 }]])
    cleanup()
  })

  it('filters out items with no name and no value', () => {
    const { editor, persisted, cleanup } = setup({ initial: [one] })
    editor.add()
    flushSync()
    vi.advanceTimersByTime(300)
    // The blank has a default name, so it persists; blank the name to drop it.
    editor.items[1].name = '  '
    flushSync()
    vi.advanceTimersByTime(300)
    expect(persisted.at(-1)).toEqual([{ id: 'a', name: 'Existing', value: 10 }])
    cleanup()
  })

  it('add() closes other items and appends an editing blank', () => {
    const { editor, cleanup } = setup({ initial: [one] })
    editor.items[0].editing = true
    editor.add()
    expect(editor.items[0].editing).toBe(false)
    expect(editor.items[1]).toEqual({
      id: 'new-2',
      name: 'Item 2',
      value: undefined,
      editing: true,
    })
    cleanup()
  })

  it('duplicate() inserts a renamed copy right after the original', () => {
    const { editor, cleanup } = setup({ initial: [one] })
    editor.add()
    editor.duplicate(editor.items[0])
    expect(editor.items.map((i) => i.name)).toEqual(['Existing', 'Existing copy', 'Item 2'])
    expect(editor.items[1].id).not.toBe('a')
    cleanup()
  })

  it('remove() deletes the item', () => {
    const { editor, cleanup } = setup({ initial: [one] })
    editor.remove(editor.items[0])
    expect(editor.items).toEqual([])
    cleanup()
  })

  it('exposes hasAnyValue for the onHasValueChange callbacks', () => {
    const { editor, cleanup } = setup({ initial: [one] })
    expect(editor.hasAnyValue).toBe(true)
    editor.items[0].value = undefined
    expect(editor.hasAnyValue).toBe(false)
    cleanup()
  })

  it('flushSave() cancels the debounce and saves immediately (onDestroy path)', () => {
    const { editor, persisted, cleanup } = setup({ initial: [one] })
    editor.items[0].value = 99
    flushSync()
    editor.flushSave()
    expect(persisted).toEqual([[{ id: 'a', name: 'Existing', value: 99 }]])
    vi.advanceTimersByTime(1000)
    expect(persisted).toHaveLength(1)
    cleanup()
  })

  it('maps ZodError issues onto the offending item and clears them on success', () => {
    let failNext = true
    const persisted: StoredThing[][] = []
    const { editor, cleanup } = setup({
      initial: [one, { id: 'b', name: 'Other', value: 5 }],
      persist: (items) => {
        if (failNext) {
          throw new z.ZodError([
            {
              code: 'custom',
              path: ['things', 1, 'value'],
              message: 'value_is_required',
              input: undefined,
            },
            {
              code: 'custom',
              path: ['things', 1, 'value'],
              message: 'value_is_required',
              input: undefined,
            },
          ])
        }
        persisted.push(items)
      },
    })

    editor.items[1].value = 7
    flushSync()
    vi.advanceTimersByTime(300)
    // Issues land on the second persisted item ('b'), deduplicated.
    expect(editor.errors).toEqual({ b: ['value_is_required'] })

    failNext = false
    editor.items[1].value = 8
    flushSync()
    vi.advanceTimersByTime(300)
    expect(editor.errors).toEqual({})
    expect(persisted).toHaveLength(1)
    cleanup()
  })

  it('swallows non-Zod persist failures without breaking the editor', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { editor, cleanup } = setup({
      initial: [one],
      persist: () => {
        throw new Error('unexpected')
      },
    })
    editor.items[0].value = 1
    flushSync()
    vi.advanceTimersByTime(300)
    expect(editor.errors).toEqual({})
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
    cleanup()
  })
})
