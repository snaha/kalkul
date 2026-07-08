# Kalkul

Financial portfolio management application built with SvelteKit and TypeScript.

## Tech Stack

- **Frontend**: SvelteKit 2.16+ with Svelte 5 (runes)
- **UI Components**: shadcn-svelte (bits-ui + Tailwind CSS v4)
- **Language**: TypeScript (strict mode)
- **Storage**: localStorage (local-first SPA)
- **Testing**: Vitest (unit) + Playwright (component & e2e)
- **Node**: >=22, **pnpm**: 11.x

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Development Commands

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm preview          # Preview production build

pnpm check            # TypeScript type checking
pnpm lint             # Run linting
pnpm format           # Auto-format code

pnpm test             # Run all tests
pnpm test:unit        # Run unit tests (Vitest)
pnpm test:ct          # Run component tests (Playwright)
pnpm test:integration # Run e2e tests (Playwright)
```

## Project Structure

- `src/lib/@snaha/kalkul-maths/` - Financial calculation engine with precise decimal arithmetic
- `src/lib/stores/` - Svelte 5 runes-based state management
- `src/lib/components/` - Reusable Svelte components
- `src/routes/(app)/` - Main application routes

## Deployments

- [`next.kalkul.app`](https://next.kalkul.app) - Production (Static SPA on GitHub Pages)
- `next.kalkul.app/pr-{num}` - PR previews (Static SPA)

## Environment Variables

| Variable        | Default | Description                        |
| --------------- | ------- | ---------------------------------- |
| `VITE_ROUTER`   |         | Router type (`hash` or `pathname`) |
| `VITE_BASE_URL` |         | Base path for deployment           |

## Testing

### Test Types

1. **Unit Tests** (`pnpm test:unit`) - Vitest
   - Business logic, utilities, and stores
   - Fast execution, no browser required
   - Files: `*.test.ts`

2. **Component Tests** (`pnpm test:ct`) - Playwright Component Testing
   - Individual component behavior and user interactions
   - Real browser environment with cross-browser testing (Chrome, Firefox, Safari)
   - Files: `*.ct.spec.ts`

3. **E2E Tests** (`pnpm test:integration`) - Playwright
   - Full application workflows
   - Files: `tests/*.test.ts`

### Component Testing Examples

Component tests are ideal for testing complex UI components like the formatted number input:

```typescript
// src/lib/components/ui/input/formatted-number/formatted-number-input.ct.spec.ts
test('should format numbers correctly', async ({ mount }) => {
  const component = await mount(FormattedNumberInput, {
    props: { value: 1234.56, locale: 'en-US' },
  })
  const input = component.locator('input')
  await expect(input).toHaveValue('1,234.56')
})
```

### Testing Best Practices

- Use hardcoded expected values instead of regex patterns in assertions
- Test cross-browser compatibility for user interaction components
- Use `--reporter=list` to avoid HTML server for faster CI runs
- Financial calculations must have comprehensive test coverage

## State Management: Nested AppStore

The application uses a single nested reactive store (`appStore`) that manages all domain data for a single user. Data is persisted to localStorage and enriched with CRUD methods at each level of the hierarchy.

### Data Hierarchy

```
appStore
├── profile: ProfileStore
└── portfolios: PortfolioStore[]
    ├── investments: InvestmentStore[]
    │   └── transactions: TransactionStore[]
    └── goals: InvestmentStore[]
        └── transactions: TransactionStore[]
```

Goals and investments share the same `InvestmentStore` type but are stored in separate arrays on each portfolio. Goals are distinguished by having `goal_data` populated.

### How Enrichment Works

Raw data loaded from localStorage is plain JSON. The store "enriches" this data by wrapping it in plain object literals that expose CRUD methods and a `toJSON()` implementation. This means:

- `toJSON()` returns the underlying plain data, so `JSON.stringify()` stays safe for persistence
- Child stores receive their parent explicitly as arguments, so `delete()` and `duplicate()` can modify the parent's array directly
- After any mutation, `persist()` saves to localStorage and the relevant store array is reassigned to trigger Svelte's `$state` reactivity

### AppStore Root

| Method / Property     | Description                                      |
| --------------------- | ------------------------------------------------ |
| `profile`             | Reactive user profile (name, email, birth_date)  |
| `portfolios`          | Reactive array of all enriched portfolios        |
| `loading`             | `true` until initial data load completes         |
| `load()`              | Load from localStorage and enrich all objects    |
| `clear()`             | Wipe all data and persisted storage, ready state |
| `updateProfile(data)` | Update user profile                              |
| `addPortfolio(data)`  | Add a new portfolio, returns ID                  |
| `exportBackup()`      | JSON string of all data                          |
| `importBackup(json)`  | Import and enrich from JSON string               |

### PortfolioStore

| Method                | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `update(updates)`     | Update name, currency, dates, inflation_rate                  |
| `delete()`            | Remove portfolio from store                                   |
| `duplicate()`         | Deep copy with all investments/goals/transactions, returns ID |
| `addInvestment(data)` | Add to investments array, returns ID                          |
| `addGoal(data)`       | Add to goals array, returns ID                                |

### InvestmentStore

| Method / Property      | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `update(updates)`      | Update investment properties                                           |
| `delete()`             | Remove from parent portfolio (auto-detects investments vs goals array) |
| `duplicate()`          | Deep copy with all transactions, returns ID                            |
| `addTransaction(data)` | Add transaction, returns ID                                            |
| `hidden`               | (getter) Whether hidden in UI via `hiddenInvestmentIds` set            |
| `toggleHide()`         | Toggle visibility                                                      |
| `focused`              | (getter) Whether this is the only visible investment among siblings    |
| `toggleFocus()`        | Hide all siblings, or show all if already focused                      |

### TransactionStore

| Method            | Description                   |
| ----------------- | ----------------------------- |
| `update(updates)` | Update transaction properties |
| `delete()`        | Remove from parent investment |
| `duplicate()`     | Copy transaction, returns ID  |

### Usage Example

```typescript
// Update profile
appStore.updateProfile({ name: 'John' })

// Add and work with portfolios
const portfolioId = appStore.addPortfolio({ name: 'Retirement', ... })
const portfolio = appStore.portfolios.find((p) => p.id === portfolioId)
portfolio?.update({ name: 'New Name' })

// Add nested data
const investmentId = portfolio?.addInvestment({ name: 'ETF', apy: 7, ... })
const investment = portfolio?.investments.find((i) => i.id === investmentId)
investment?.addTransaction({ amount: 1000, date: '2024-01-01', type: 'deposit', ... })

// Delete (automatically removes from parent)
investment?.delete()
```

## Conventions

- Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- Financial calculations must use Decimal.js for precision
- All dates handled through `@snaha/kalkul-maths/date` utilities
- Run `pnpm check` before committing
