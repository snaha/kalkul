import type { KnipConfig } from 'knip'

// `pnpm knip` runs this config twice: `knip && knip --production`.
//
// The trailing `!` on a pattern marks it as a PRODUCTION entry/file
// (https://knip.dev/features/production-mode):
//
// - Default mode ignores the marker and analyzes everything: the entries
//   below plus entries added by plugins (the vitest plugin adds *.test.ts
//   files, the svelte plugin adds SvelteKit files). This pass finds unused
//   dependencies, files, and exports across app, tests, and tooling.
//
// - Production mode (--production) follows ONLY the `!`-marked patterns, so
//   the analysis starts exclusively from the shipped app (the SPA shell and
//   the routes). Test files are not entries in this pass, which is what makes
//   it able to report code that is reachable solely from its own tests.
//
// Do not add test globs to `entry`: a plain (unmarked) test entry would make
// "a module plus its own test" count as used again, re-hiding test-only dead
// code — the legacy state layer went unnoticed exactly that way (#101).
const config: KnipConfig = {
  entry: ['src/app.html!', 'src/routes/**/*!'],
  // `!` scopes production mode the same way for project files: scripts/ is
  // dev tooling (check-locales), analyzed in default mode but exempt from
  // "is this reachable from the app?" reporting.
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
