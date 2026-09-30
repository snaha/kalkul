import svelteParser from 'svelte-eslint-parser'

import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginSvelte from 'eslint-plugin-svelte'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/recommended'],
  eslintConfigPrettier,
  ...eslintPluginSvelte.configs['flat/prettier'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: typescriptEslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['src/lib/components/ui/**/*.svelte'],
    rules: {
      'svelte/valid-compile': 'off',
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // @modelcontextprotocol/sdk exports `./*` -> `./dist/esm/*` and needs the .js suffix.
          selector:
            'ImportDeclaration[source.value=/^(?!@modelcontextprotocol\\/sdk\\/).*\\/.*\\.(?!(svelte|svg|json|css)$)\\w+$/]',
          message:
            'Unnecessary file extension in import. Only .svelte, .svg, .json, and .css extensions are allowed.',
        },
        {
          selector: 'ImportDeclaration[source.value=/\\/index$/]',
          message: 'Do not import from /index explicitly. Import from the directory instead.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lucide/svelte',
              message: 'Import icons via deep paths: @lucide/svelte/icons/<name>',
            },
          ],
        },
      ],
    },
  },
  {
    // A plugin reaches the app only through the PluginHost it is given
    // (src/lib/plugins/types.ts). It may use the UI kit and a few shared
    // helpers, but not the app's stores, data or other modules.
    files: ['src/lib/plugins/*/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lucide/svelte',
              message: 'Import icons via deep paths: @lucide/svelte/icons/<name>',
            },
          ],
          patterns: [
            {
              group: [
                '$lib/*',
                // Gitignore-style: a parent must be re-included before a child.
                '!$lib/components',
                '$lib/components/*',
                '!$lib/components/ui',
                '!$lib/utils',
                '!$lib/routes',
                '../../*',
              ],
              message:
                'A plugin uses the app only through its PluginHost; import from its own folder, ../types, the UI kit, $lib/utils or $lib/routes.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      '**/.svelte-kit',
      '**/build',
      '**/dist',
      '**/node_modules',
      '**/package',
      '**/static/generated/css',
      'src/lib/types.ts',
      'src/lib/typesdb.ts',
      '.claude/settings.local.json',
      '**/.cache',
      '**/playwright-report',
      '**/test-results',
    ],
  },
)
