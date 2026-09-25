import { z } from 'zod'

/**
 * Zod decides per object schema, at the moment the schema is *built*, whether
 * to JIT-compile its parser with `new Function`. Its feature probe is wrapped
 * in try/catch, so nothing breaks under kalkul.app's CSP (script-src has no
 * 'unsafe-eval'), but the browser still logs a violation on every load.
 *
 * `jitless` short-circuits the probe, so it must be set before the first
 * `z.object()` anywhere: ours in `schemas.ts` and the MCP SDK's, which builds
 * dozens on import. `src/hooks.client.ts` imports this module before any route
 * code runs; `zod-config.test.ts` pins that the probe stays untouched with both
 * loaded. The cost is that every object parse app-wide takes Zod's
 * interpreted path instead of the compiled one, negligible at this data size.
 */
z.config({ jitless: true })
