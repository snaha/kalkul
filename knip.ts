import type { KnipConfig } from 'knip'

// Test files are picked up by knip's vitest plugin automatically, so they are
// deliberately NOT listed as entries here. That keeps `knip --production`
// meaningful: it only follows the production entries below (the `!` suffix),
// so code reachable solely from its own tests is reported instead of hidden
// (issue #101's dead legacy state layer survived exactly that way).
const config: KnipConfig = {
  entry: ['src/app.html!', 'src/routes/**/*!'],
  // scripts/ is dev tooling: analyzed in default mode, out of scope for
  // --production (the `!` marks what counts as production project files).
  project: ['src/**/*!', 'scripts/**'],
  paths: {
    '$app/*': ['node_modules/@sveltejs/kit/src/runtime/app/*'],
    '$env/*': ['.svelte-kit/ambient.d.ts'],
    '$lib/*': ['src/lib/*'],
  },
  ignore: ['scripts/test-locales-examples.svelte'],
  ignoreExportsUsedInFile: true,
}

export default config
