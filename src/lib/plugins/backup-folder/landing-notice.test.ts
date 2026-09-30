import { describe, expect, it } from 'vitest'

import { landingNotice } from './landing-notice'

describe('landingNotice', () => {
  it('suggests dropping the folder while none is connected', () => {
    expect(landingNotice({ kind: 'disconnected' })).toBe('drop')
    expect(landingNotice({ kind: 'folder-missing' })).toBe('drop')
  })

  it('says it is connecting during the first round', () => {
    expect(landingNotice({ kind: 'checking' })).toBe('connecting')
    expect(landingNotice({ kind: 'syncing' })).toBe('connecting')
  })

  it('explains a connected folder that had nothing to load', () => {
    expect(landingNotice({ kind: 'synced' })).toBe('empty')
  })

  it('points to settings for anything that needs the user', () => {
    expect(landingNotice({ kind: 'fork', versions: [] })).toBe('attention')
    expect(landingNotice({ kind: 'needs-permission' })).toBe('attention')
    expect(landingNotice({ kind: 'error' })).toBe('attention')
    expect(landingNotice({ kind: 'unreadable', remoteTime: 0, remoteDevice: 'b' })).toBe(
      'attention',
    )
    expect(landingNotice({ kind: 'held', remoteTime: 0, remoteDevice: 'b' })).toBe('attention')
  })
})
