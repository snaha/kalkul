// Side-effect imports keep their place (see importOrderSideEffects in
// .prettierrc); this one has to come before anything that builds a schema.
import '$lib/zod-config'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { util } from 'zod/v4/core'

// The MCP SDK builds its object schemas on import, before ours.
import '$lib/mcp/mcp-server'
import '$lib/schemas'

describe('zod config', () => {
  it('runs jitless, so the eval probe never runs even with the MCP SDK loaded', () => {
    expect(z.config().jitless).toBe(true)
    // `new Function` works here, so the probe would answer true had it run;
    // false means Zod took the jitless short-circuit ahead of it.
    expect(util.allowsEval.value).toBe(false)
  })
})
