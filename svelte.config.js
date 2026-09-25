import staticAdapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const analytics = !!process.env.VITE_UMAMI_WEBSITE_ID

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    // The curated sample profiles double as the dev page's realistic presets,
    // so they need to be importable from src/ without a ../../.. climb.
    alias: {
      $examples: 'examples',
    },
    router: {
      type: process.env.VITE_ROUTER,
    },
    paths: {
      base: process.env.VITE_BASE_URL ?? '',
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
        'script-src': ['self', ...(analytics ? ['https://cloud.umami.is'] : [])],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        // Loopback websockets only: the optional local AI relay (server/index.ts).
        // Browsers treat localhost as trustworthy, so even the https production
        // site can reach a relay running on the user's machine (Chrome, Firefox;
        // Safari blocks it). A malicious script still cannot reach a remote host.
        'connect-src': [
          'self',
          ...(analytics ? ['https://gateway.umami.is'] : []),
          'ws://localhost:*',
          'ws://127.0.0.1:*',
        ],
        'object-src': ['none'],
        'base-uri': ['self'],
      },
    },
  },
}

export default config
