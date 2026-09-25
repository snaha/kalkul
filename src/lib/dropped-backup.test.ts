import { describe, expect, it } from 'vitest'

import { carriesFiles, pickDroppedBackup } from './dropped-backup'

function file(name: string): File {
  return new File(['{}'], name, { type: 'application/json' })
}

describe('carriesFiles', () => {
  it('is true when the drag carries files', () => {
    expect(carriesFiles(['Files'])).toBe(true)
    expect(carriesFiles(['text/uri-list', 'Files'])).toBe(true)
  })

  it('is false for text or link drags', () => {
    expect(carriesFiles(['text/plain'])).toBe(false)
    expect(carriesFiles(['text/uri-list', 'text/html'])).toBe(false)
  })

  it('is false when there is no type list', () => {
    expect(carriesFiles(undefined)).toBe(false)
    expect(carriesFiles([])).toBe(false)
  })
})

describe('pickDroppedBackup', () => {
  it('returns none when no files were dropped', () => {
    expect(pickDroppedBackup([])).toEqual({ kind: 'none' })
  })

  it('refuses to guess between several files', () => {
    expect(pickDroppedBackup([file('a.kalkul.json'), file('b.kalkul.json')])).toEqual({
      kind: 'too-many',
    })
  })

  it('accepts a single .kalkul.json file', () => {
    const backup = file('kalkul-2026-09-25.kalkul.json')
    expect(pickDroppedBackup([backup])).toEqual({ kind: 'file', file: backup })
  })

  it('accepts a plain .json file, whatever the case', () => {
    const plain = file('backup.json')
    const upper = file('BACKUP.JSON')
    expect(pickDroppedBackup([plain])).toEqual({ kind: 'file', file: plain })
    expect(pickDroppedBackup([upper])).toEqual({ kind: 'file', file: upper })
  })

  it('rejects a file that is not JSON and names it', () => {
    expect(pickDroppedBackup([file('notes.txt')])).toEqual({
      kind: 'wrong-type',
      name: 'notes.txt',
    })
    expect(pickDroppedBackup([file('backup.json.txt')])).toEqual({
      kind: 'wrong-type',
      name: 'backup.json.txt',
    })
  })
})
