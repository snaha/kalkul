import { describe, expect, it } from 'vitest'

import { UnreadableBackupError } from './sync-engine'
import { awaitsChoice, shouldAutoSync, statusForError, statusForOutcome } from './sync-status'

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

  it('lists the branches of a fork, newest first', () => {
    const version = (hash: string, device: string, time: number) => ({
      hash,
      parents: [],
      device,
      time,
      id: hash,
    })
    expect(
      statusForOutcome({
        kind: 'fork',
        heads: [version('aaaaaaaaaaaa', 'a-1', 1), version('bbbbbbbbbbbb', 'b-1', 2)],
      }),
    ).toEqual({
      kind: 'fork',
      versions: [
        { hash: 'bbbbbbbbbbbb', device: 'b-1', time: 2 },
        { hash: 'aaaaaaaaaaaa', device: 'a-1', time: 1 },
      ],
    })
  })
})

describe('statusForError', () => {
  it('asks for folder access again when the browser withdrew it', () => {
    expect(statusForError(new DOMException('no', 'NotAllowedError'))).toEqual({
      kind: 'needs-permission',
    })
  })

  it('names the computer whose backup this version cannot load', () => {
    const time = Date.UTC(2026, 8, 25, 10)
    const version = { hash: 'bbbbbbbbbbbb', parents: [], device: 'b-1', time, id: 'f' }
    expect(statusForError(new UnreadableBackupError(version))).toEqual({
      kind: 'unreadable',
      remoteTime: time,
      remoteDevice: 'b-1',
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
    expect(shouldAutoSync({ kind: 'conflict', remoteTime: 0, remoteDevice: 'b' })).toBe(true)
    expect(shouldAutoSync({ kind: 'fork', versions: [] })).toBe(true)
    // A newer app version's file: nothing local is touched, so retrying is safe.
    expect(shouldAutoSync({ kind: 'unreadable', remoteTime: 0, remoteDevice: 'b' })).toBe(true)
  })

  it('waits for the user when only they can fix it', () => {
    expect(shouldAutoSync({ kind: 'disconnected' })).toBe(false)
    expect(shouldAutoSync({ kind: 'needs-permission' })).toBe(false)
    expect(shouldAutoSync({ kind: 'folder-missing' })).toBe(false)
  })
})

describe('awaitsChoice', () => {
  it('is true only for the questions the user answers', () => {
    expect(awaitsChoice({ kind: 'conflict', remoteTime: 0, remoteDevice: 'b' })).toBe(true)
    expect(awaitsChoice({ kind: 'fork', versions: [] })).toBe(true)
    expect(awaitsChoice({ kind: 'synced' })).toBe(false)
    expect(awaitsChoice({ kind: 'error' })).toBe(false)
  })
})
