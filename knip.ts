import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: ['src/app.html', 'src/routes/**/*', '**/*.test.ts', '**/*.spec.ts'],
  paths: {
    '$app/*': ['node_modules/@sveltejs/kit/src/runtime/app/*'],
    '$env/*': ['.svelte-kit/ambient.d.ts'],
    '$lib/*': ['src/lib/*'],
  },
  ignore: ['src/lib/typesdb.ts', 'scripts/test-locales-examples.svelte'],
  ignoreExportsUsedInFile: true,
}

export default config
