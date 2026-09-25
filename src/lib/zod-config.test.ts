// Side-effect imports keep their place (see importOrderSideEffects in
// .prettierrc); this one has to come before anything that builds a schema.
import '$lib/zod-config'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { util } from 'zod/v4/core'

// The MCP SDK builds its object schemas on import, before ours.
import '$lib/mcp/server'
import '$lib/schemas'

describe('zod config', () => {
  it('runs jitless, so the eval probe never runs even with the MCP SDK loaded', () => {
    expect(z.config().jitless).toBe(true)
    // Zod caches the probe result by replacing this getter with a plain value
    // the first time it runs; a getter still being there means it never did.
    const probe = Object.getOwnPropertyDescriptor(util.allowsEval, 'value')
    expect(typeof probe?.get).toBe('function')
  })
})
