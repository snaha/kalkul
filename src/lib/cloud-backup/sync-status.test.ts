import { describe, expect, it } from 'vitest'

import { shouldAutoSync, statusForError, statusForOutcome } from './sync-status'

describe('statusForOutcome', () => {
  it('shows a finished round as synced', () => {
    expect(statusForOutcome({ kind: 'pushed', hash: 'aaaaaaaaaaaa' })).toEqual({ kind: 'synced' })
    expect(statusForOutcome({ kind: 'pulled', hash: 'aaaaaaaaaaaa', device: 'b-1' })).toEqual({
      kind: 'synced',
    })
    expect(statusForOutcome({ kind: 'up-to-date' })).toEqual({ kind: 'synced' })
  })

  it("carries the other version's time and device into a conflict", () => {
    const time = Date.UTC(2026, 8, 25, 10)
    expect(
      statusForOutcome({
        kind: 'conflict',
        remote: { hash: 'bbbbbbbbbbbb', parents: [], device: 'b-1', time, id: 'f' },
      }),
    ).toEqual({ kind: 'conflict', remoteTime: time, remoteDevice: 'b-1' })
  })
})

it("shows a held download with the other computer's name and time", () => {
  const time = Date.UTC(2026, 8, 25, 10)
  expect(
    statusForOutcome({
      kind: 'held',
      remote: { hash: 'bbbbbbbbbbbb', parents: [], device: 'b-1', time, id: 'f' },
    }),
  ).toEqual({ kind: 'held', remoteTime: time, remoteDevice: 'b-1' })
})

describe('statusForError', () => {
  it('asks for folder access again when the browser withdrew it', () => {
    expect(statusForError(new DOMException('no', 'NotAllowedError'))).toEqual({
      kind: 'needs-permission',
    })
  })

  it('reports anything else as an error to retry', () => {
    expect(statusForError(new Error('not downloaded yet'))).toEqual({ kind: 'error' })
  })
})

describe('shouldAutoSync', () => {
  it('keeps syncing in the background while things work or might recover', () => {
    expect(shouldAutoSync({ kind: 'synced' })).toBe(true)
    expect(shouldAutoSync({ kind: 'error' })).toBe(true)
    expect(shouldAutoSync({ kind: 'held', remoteTime: 0, remoteDevice: 'b' })).toBe(true)
    expect(shouldAutoSync({ kind: 'conflict', remoteTime: 0, remoteDevice: 'b' })).toBe(true)
  })

  it('waits for the user when only they can fix it', () => {
    expect(shouldAutoSync({ kind: 'disconnected' })).toBe(false)
    expect(shouldAutoSync({ kind: 'needs-permission' })).toBe(false)
    expect(shouldAutoSync({ kind: 'folder-missing' })).toBe(false)
  })
})
