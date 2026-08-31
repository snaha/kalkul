import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // The dev page imports the sample profiles from `examples/`, which sits
  // outside the roots SvelteKit allows Vite to serve (src, .svelte-kit,
  // node_modules). This only affects local development — in a build the JSON is
  // bundled like any other import.
  server: { fs: { allow: ['examples'] } },
  // Tests that exercise Svelte effects need the client runtime — plain node
  // resolution would load Svelte's server build, where effects are inert
  // no-ops. Prefer the browser condition when running under Vitest (both
  // pipelines: web transforms and the SSR-mode default).
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  ssr: process.env.VITEST ? { resolve: { conditions: ['browser'] } } : undefined,
  test: {
    // *.test.svelte.ts files use runes in the test body (e.g. $effect.root
    // for testing rune-based factories). The .svelte.ts suffix makes the
    // Svelte plugin compile them; such files must also declare the happy-dom
    // environment via a vitest-environment pragma on their first line so they
    // get web (client) transforms — the default node environment compiles
    // Svelte in SSR mode, where effects are inert no-ops.
    include: ['src/**/*.test.ts', 'src/**/*.test.svelte.ts'],
    server: {
      deps: {
        // Vitest externalizes node_modules by default, so `svelte` would be
        // imported through node's own resolver (node condition → server
        // runtime). Inline it so the browser conditions above apply and the
        // client runtime's effects actually run in tests.
        inline: [/^svelte$/, /^svelte\//],
      },
    },
  },
})
