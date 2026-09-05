import staticAdapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
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
    // transitions and the chart library's inline style attributes.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        // Loopback websockets only: the optional local AI relay (server/index.ts).
        // A malicious script still cannot reach a remote host.
        'connect-src': ['self', 'ws://localhost:*', 'ws://127.0.0.1:*'],
        'object-src': ['none'],
        'base-uri': ['self'],
      },
    },
  },
}

export default config
