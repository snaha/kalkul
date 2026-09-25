import svelteParser from 'svelte-eslint-parser'

import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginSvelte from 'eslint-plugin-svelte'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

// Flat config replaces rule options per block instead of merging them, so the
// plan-route block below spreads these in beside its own.
const restrictedImportSyntax = [
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
]

const profileWrites =
  /^(updateProfile|confirmBalances|saveSnapshot|deleteSnapshot|importBackup|clear)$/

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
      'no-restricted-syntax': ['error', ...restrictedImportSyntax],
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
    // A projection never writes financial data (AGENTS.md): the plan route
    // writes to its plan only, through src/lib/plan-items.ts or plan.update.
    files: ['src/routes/(app)/plan/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedImportSyntax,
        {
          // appStore.updateProfile, appStore['updateProfile'] and
          // const { updateProfile } = appStore alike.
          selector: `:matches(MemberExpression[object.name='appStore'][property.name=${profileWrites}], MemberExpression[object.name='appStore'][property.value=${profileWrites}], VariableDeclarator[init.name='appStore'] > ObjectPattern > Property[key.name=${profileWrites}])`,
          message:
            'Financial data is never written from a projection. Change the plan instead (src/lib/plan-items.ts, plan.update).',
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
