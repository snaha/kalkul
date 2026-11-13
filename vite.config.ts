import staticAdapter from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const analytics = !!process.env.VITE_UMAMI_WEBSITE_ID

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      // The curated sample profiles double as the dev page's realistic presets,
      // so they need to be importable from src/ without a ../../.. climb.
      // SvelteKit 3 generates no `$lib`; its replacement, `#lib`, needs a file
      // extension on every import, which this repo's import style omits.
      alias: {
        $lib: 'src/lib',
        $examples: 'examples',
      },
      router: {
        type: process.env.VITE_ROUTER as 'pathname' | 'hash' | undefined,
      },
      paths: {
        base: (process.env.VITE_BASE_URL ?? '') as '' | `/${string}`,
      },
      adapter: staticAdapter({ fallback: 'index.html' }),
      // All financial data lives in localStorage on this origin, so any XSS or
      // compromised dependency could exfiltrate it. GitHub Pages can't set
      // response headers; kit.csp injects the policy as a <meta> tag into the
      // SPA fallback page at build time. 'hash' mode allowlists SvelteKit's own
      // inline init script. 'unsafe-inline' styles are required by Svelte
      // transitions and the chart library's inline style attributes. The one
      // remote service allowed is Umami Cloud, and only in a build that enables
      // analytics (VITE_UMAMI_WEBSITE_ID, see README): the root layout loads its
      // tracker script from cloud.umami.is, and the script posts page views and
      // events to gateway.umami.is, its built-in default endpoint.
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self', ...(analytics ? (['https://cloud.umami.is'] as const) : [])],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          // Loopback websockets only: the optional local AI relay (server/index.ts).
          // Browsers treat localhost as trustworthy, so even the https production
          // site can reach a relay running on the user's machine (Chrome, Firefox;
          // Safari blocks it). A malicious script still cannot reach a remote host.
          'connect-src': [
            'self',
            ...(analytics ? (['https://gateway.umami.is'] as const) : []),
            'ws://localhost:*',
            'ws://127.0.0.1:*',
          ],
          'object-src': ['none'],
          'base-uri': ['self'],
        },
      },
    }),
  ],
  // The dev page imports the sample profiles from `examples/`, which sits
  // outside the roots SvelteKit allows Vite to serve (src, .svelte-kit,
  // node_modules). This only affects local development — in a build the JSON is
  // bundled like any other import.
  server: {
    fs: { allow: ['examples'] },
    // A launcher (e.g. a second dev server alongside another) can pick the
    // port through PORT; otherwise Vite's default, 5173.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
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
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.svelte.ts',
      'server/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
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
