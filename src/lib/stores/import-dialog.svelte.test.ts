import { beforeEach, describe, expect, it } from 'vitest'

import { importDialogStore } from './import-dialog.svelte'

function file(name: string): File {
  return new File(['{}'], name, { type: 'application/json' })
}

describe('importDialogStore', () => {
  beforeEach(() => {
    importDialogStore.open = false
  })

  it('opens for picking a file', () => {
    importDialogStore.openPicker()
    expect(importDialogStore.open).toBe(true)
    expect(importDialogStore.droppedFile).toBe(undefined)
  })

  it('opens with a dropped file', () => {
    const backup = file('backup.kalkul.json')
    importDialogStore.openWithFile(backup)
    expect(importDialogStore.open).toBe(true)
    expect(importDialogStore.droppedFile).toBe(backup)
  })

  it('swaps the file in place when another is dropped while it is open', () => {
    const second = file('second.kalkul.json')
    importDialogStore.openWithFile(file('first.kalkul.json'))
    importDialogStore.openWithFile(second)
    expect(importDialogStore.open).toBe(true)
    expect(importDialogStore.droppedFile).toBe(second)
  })

  it('forgets the dropped file when closed', () => {
    importDialogStore.openWithFile(file('backup.kalkul.json'))
    importDialogStore.open = false
    expect(importDialogStore.droppedFile).toBe(undefined)
  })

  it('drops back to picking a file after a failed import', () => {
    importDialogStore.openWithFile(file('broken.json'))
    importDialogStore.forgetDroppedFile()
    expect(importDialogStore.open).toBe(true)
    expect(importDialogStore.droppedFile).toBe(undefined)
  })

  it('clears a dropped file when opened for picking', () => {
    importDialogStore.openWithFile(file('backup.kalkul.json'))
    importDialogStore.openPicker()
    expect(importDialogStore.droppedFile).toBe(undefined)
  })
})
