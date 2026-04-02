# AGENTS.md

This file provides guidance to LLM AI agents like Claude Code, Gemini and OpenAI Codex when working with code in this repository.

## Quick Reference

See `README.md` for development commands, project structure, and conventions.

## AI-Specific Guidelines

### Understanding the Codebase

**Kalkul** is a financial portfolio management application built as a local-first static SPA using localStorage for data persistence. Key areas to understand:

1. **Financial Calculations** (`src/lib/@snaha/kalkul-maths/`)

   - Always use Decimal.js for monetary calculations
   - Never use native JavaScript numbers for financial data
   - Test extensively when modifying calculation logic

2. **State Management** (`src/lib/stores/`)

   - Uses Svelte 5 runes (`.svelte.ts` files)
   - State is reactive and type-safe
   - Follow existing patterns when adding new stores

3. **Internationalization (i18n)**

   - Uses `svelte-i18n` library for translations
   - Translation files in `src/lib/locales/` (currently `cs.json` and `en.json`)
   - Nested structure for organized translations (e.g., `page.account.settings`)
   - Import with `import { _ } from 'svelte-i18n'` and use as `$_('key.path')`
   - Initialize in `src/lib/locales/index.ts` with Czech (`cs`) as default
   - Browser language auto-detected in `src/routes/+layout.ts`
   - Do not use trailing commas in the translation JSON files. Running `pnpm format` fixes the formatting of all files, including the JSON translation files.
   - Running `pnpm check-locales` returns a list of missing localizations and a list of non-used labels from the JSON translation files.
   - **IMPORTANT**: When updating localization text, ALWAYS update ALL language files (currently `cs.json` and `en.json`)
   - Never update only one language file - this creates inconsistencies between languages
   - Always maintain the same structure and parameter names across all languages

   Example usage:

   ```svelte
   <script>
     import { _, locale } from 'svelte-i18n'
   </script>

   <h1>{$_('page.account.settings')}</h1>
   <p>{$_('page.account.firstPaymentOn', { values: { date: '2024-01-01' } })}</p>
   ```

   **Accessing current locale**: Use `$locale` directly instead of `get(locale)`

   - Example: `new Date().toLocaleDateString($locale ?? undefined)` instead of `new Date().toLocaleDateString(get(locale) || 'cs')`
   - This avoids unnecessary imports of `get` from `svelte/store` and is more reactive

### Important Patterns

1. **Type Safety**

   - TypeScript strict mode is enabled
   - Always run `pnpm check` before committing
   - **CRITICAL: Never use `null` in your code** - always use `undefined` instead for optional/missing values
   - **Exceptions where `null` is allowed:**
     - When `null` comes from external libraries or APIs (e.g., DOM methods that return `null`)
   - When checking for missing values, use `!value` or `value === undefined`, not `value === null`
   - **ENFORCEMENT**: Before any file edit, scan your changes for the literal `null` and replace with `undefined`
   - Return types should be `T | undefined`, never `T | null`
   - Function parameters should default to `undefined`, never `null`
   - **Never use `any` type** - always use proper TypeScript types for type safety
   - Use generic types, union types, or `unknown` instead of `any` when needed
   - If you must accept any type, use `unknown` and type guards for safety

### Naming Conventions

- **File naming**: Use kebab-case for all file names (e.g., `user-profile.ts`, `email-template.svelte`)
- **Directory naming**: Use kebab-case for directory names (e.g., `email-templates/`, `user-settings/`)
- **Component naming**: Svelte components should use PascalCase for the component name but kebab-case for the file name (e.g., `UserProfile.svelte` → `user-profile.svelte`)

### Import Conventions

- **Never use dynamic imports**: Always use static imports at the top of the file
  - ✅ `import { something } from '$lib/utils'` at the top of the file
  - ❌ `const module = await import('$lib/utils')` inside a function
- **Omit file extensions**: Omit `.js` extensions in import statements
  - ✅ `import { Server } from '@modelcontextprotocol/sdk/server/index'`
  - ❌ `import { Server } from '@modelcontextprotocol/sdk/server/index.js'`

2. **Testing Financial Logic**

   - Financial calculations must have unit tests
   - Use test files alongside source (`*.test.ts`)
   - Test edge cases with various decimal precisions

3. **Component Architecture**

   - Components in `src/lib/components/` are reusable
   - Route-specific components stay in route folders
   - Use composition over inheritance

4. **UI Components (shadcn-svelte)**

   - Uses **shadcn-svelte** for UI components (built on bits-ui + Tailwind CSS v4)
   - UI components are located in `src/lib/components/ui/`
   - Add new components via CLI: `pnpm dlx shadcn-svelte@next add <component>`
   - Configuration in `components.json` at project root
   - Always prefer shadcn-svelte components over custom HTML elements for consistency
   - Use Tailwind CSS utility classes for styling and layout
   - Use `cn()` utility from `$lib/utils` for conditional class merging

### Common Tasks

1. **Adding a New Feature**

   - Check existing patterns in similar features
   - Add tests for business logic
   - Use conventional commits

2. **Modifying Financial Calculations**

   - Review existing tests in `@snaha/kalkul-maths`
   - Always use Decimal.js
   - Consider precision and rounding implications
   - Add comprehensive test coverage

3. **Working with State**

   - Use existing stores when possible
   - Follow Svelte 5 runes patterns
   - Keep stores focused and single-purpose

### Deployment Context

- The app is deployed as a static SPA everywhere (production and PR previews)
- Production is hosted on GitHub Pages at `next.kalkul.app`
- Data is stored locally in the browser via localStorage
- Environment variables control routing and base URL
- See README.md for deployment details

### Testing Strategy

**Kalkul uses a three-tier testing approach:**

1. **Unit Tests** (`pnpm test:unit` - Vitest)

   - Financial calculations and business logic
   - Utilities and helper functions
   - Store/state management
   - Files: `*.test.ts`

2. **Component Tests** (`pnpm test:ct` - Playwright)

   - UI component behavior and user interactions
   - Cross-browser compatibility (Chrome, Firefox, WebKit)
   - Real browser environment with actual rendering
   - Files: `*.ct.spec.ts`

3. **E2E Tests** (`pnpm test:integration` - Playwright)
   - Full application workflows
   - Files: `tests/*.test.ts`

**When to use Component Tests:**

- Complex UI components (formatted inputs, charts, modals)
- User interaction testing (typing, clicking, selection)
- Cross-browser behavior validation
- Visual component behavior

**Component Testing Best Practices:**

- Use hardcoded expected values: `await expect(input).toHaveValue('1,234.56')`
- Avoid regex patterns in assertions: ❌ `toMatch(/^10[0-9,]+$/)`
- Use `--reporter=list` to avoid HTML server for faster runs
- Test user flows step-by-step with proper waits

**Example Component Test:**

```typescript
test('should handle text selection replacement', async ({ mount }) => {
  const component = await mount(FormattedNumberInput, {
    props: { value: 1234, locale: 'en-US' },
  })
  const input = component.locator('input')

  await input.focus()
  await expect(input).toHaveValue('1,234')

  // Select "23" and replace with "9"
  await input.evaluate((el) => {
    ;(el as HTMLInputElement).setSelectionRange(2, 4)
  })
  await input.press('9')

  await expect(input).toHaveValue('1,94') // Specific expected value
})
```

### Key Reminders

- Financial precision is critical - always use Decimal.js
- Follow conventional commits strictly
- Test financial calculations thoroughly (unit tests)
- Test UI interactions comprehensively (component tests)
- Check TypeScript types before committing
- Reference README.md for commands and setup
- Run `pnpm test:unit --run` (non-watch mode) to validate changes without blocking the terminal

### Testing Commands

**Unit Tests**: Use `pnpm test:unit run [test-file]` to run unit tests once (without watch mode)

- Example: `pnpm test:unit run graph-data.test.ts`
- `pnpm test:unit` without "run" starts watch mode and runs indefinitely

### Package Management

**Installing Packages**: Always use `pnpm add -D [package]` for development dependencies

- Example: `pnpm add -D html-to-text`
- Use `pnpm add [package]` only for runtime dependencies that users need
- Most packages for development, testing, and build tools should be dev dependencies

### Pre-commit Requirements

**IMPORTANT**: Before committing any changes, you MUST run and pass:

1. `pnpm format` - Formats code with Prettier
2. `pnpm lint` - Checks code style and quality with ESLint and Prettier
3. `pnpm check` - Runs Svelte Kit sync and TypeScript type checking
4. `pnpm knip` - Finds unused files, dependencies, and exports
5. `pnpm check-locales` - Checks for missing, unused or duplicate translations

**Quick check**: Use `pnpm check:all` to run all the above checks at once (used in CI).

All commands must pass successfully before committing. This ensures code quality and prevents CI/CD failures.

**Testing check-locales patterns**: Use `pnpm check-locales --test` to validate the hardcoded text detection patterns against test cases in `scripts/test-locales-examples.svelte`. This helps ensure the regex patterns correctly identify user-facing text that should be localized while properly excluding code snippets and technical content.

**IMPORTANT**: When running `pnpm check-locales`, you MUST fix ALL issues it finds:

- Add missing localization keys for any hardcoded user-facing text
- Remove unused localization keys from JSON files
- Update components to use the localization keys instead of hardcoded strings
- Do not leave any hardcoded text or unused keys remaining
