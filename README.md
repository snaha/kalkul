# Kalkul

Financial portfolio management application built with SvelteKit and TypeScript.

## Tech Stack

- **Frontend**: SvelteKit 2.16+ with Svelte 5 (runes)
- **UI Components**: shadcn-svelte (bits-ui + Tailwind CSS v4)
- **Language**: TypeScript (strict mode)
- **Storage**: localStorage (local-first SPA)
- **Testing**: Vitest (unit)
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
pnpm server           # Local AI relay (see "AI access via MCP")

pnpm check            # TypeScript type checking
pnpm lint             # Run linting
pnpm format           # Auto-format code

pnpm test             # Run the unit test suite once
pnpm test:unit        # Run unit tests in watch mode (Vitest)
pnpm test:unit run    # Run unit tests once
```

## AI access via MCP

The browser tab can run an MCP server (`src/lib/mcp/server.ts`) whose tools read and change the
data through the app store. A small local relay (`server/index.ts`) forwards JSON-RPC between an
MCP client and the tab; it holds no data.

```bash
pnpm server                                   # relay on http://127.0.0.1:3001
claude mcp add --transport http kalkul http://127.0.0.1:3001/mcp
```

Then open the app, go to Settings → MCP server and click Connect. Tools only answer while such a
tab is open. This also works on https://kalkul.app with the relay running on your machine, in
Chrome and Firefox (Safari blocks `ws://localhost` from https pages). The relay accepts WebSocket
connections only from localhost and kalkul.app; set `KALKUL_ORIGINS` (comma-separated) to allow
more, e.g. a PR preview.

### Browser agents (WebMCP)

The same tools can be handed straight to agents that run inside the browser through the W3C
WebMCP API (`document.modelContext`, with the deprecated `navigator.modelContext` fallback), with
no relay involved. It is off by default: enable "Expose tools to browser agents" under Settings →
MCP server. Needs a browser with WebMCP, e.g. Chrome 149+ in the origin trial or with
`about:flags#enable-webmcp-testing`. Tool definitions live in `src/lib/mcp/tools.ts` and are shared
by both paths.

## Project Structure

- `src/lib/plan-projection.ts` - Plan projection engine with precise decimal arithmetic
- `src/lib/@snaha/kalkul-maths/` - Shared low-level financial math helpers
- `src/lib/stores/` - Svelte 5 runes-based state management
- `src/lib/components/` - Reusable Svelte components
- `src/routes/(app)/` - Main application routes

## Deployments

- [`kalkul.app`](https://kalkul.app) - Production (Static SPA)
- `kalkul.app/pr-{num}` - PR previews (Static SPA)

Both production and PR previews are published to the `gh-pages` branch — `main` deploys to the
root, each open PR deploys to its own `pr-{num}/` subdirectory. GitHub Pages serves that branch
at `kalkul.app`.

## Environment Variables

| Variable        | Default | Description                        |
| --------------- | ------- | ---------------------------------- |
| `VITE_ROUTER`   |         | Router type (`hash` or `pathname`) |
| `VITE_BASE_URL` |         | Base path for deployment           |

## Testing

The test suite is unit tests on Vitest (`pnpm test`, or `pnpm test:unit` for watch mode):

- Business logic, utilities, stores, and schemas
- Fast execution, no browser required
- Files: `*.test.ts` alongside the source

Component tests (Playwright CT) and browser e2e tests existed before the shadcn UI rewrite and
were removed with it; restoring workflow-level coverage is tracked in
[#100](https://github.com/snaha/kalkul/issues/100).

### Testing Best Practices

- Use hardcoded expected values instead of regex patterns in assertions
- Financial calculations must have comprehensive test coverage

## State Management: AppStore

The application uses a single reactive store (`appStore`) that manages all domain data for a
single user. All financial data (cash, investments, tangible assets, liabilities, incomes,
expenses) lives flat on the profile; portfolios ("plans") reference profile items by id and add
plan-specific settings (dates, inflation, transfers). Data is persisted to localStorage.

### Data Hierarchy

```
appStore
├── profile: ProfileStore
└── portfolios: PortfolioStore[]
```

### How Enrichment Works

Raw data loaded from localStorage is plain JSON. The store "enriches" this data by wrapping it in plain object literals that expose CRUD methods and a `toJSON()` implementation. This means:

- `toJSON()` returns the underlying plain data, so `JSON.stringify()` stays safe for persistence
- Portfolio stores receive the app store as parent, so `delete()` can modify the parent's array directly
- After any mutation, `persist()` saves to localStorage and the store array is reassigned to trigger Svelte's `$state` reactivity

### AppStore Root

| Method / Property     | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `profile`             | Reactive user profile (identity + all financial data)  |
| `portfolios`          | Reactive array of all enriched portfolios              |
| `loading`             | `true` until initial data load completes               |
| `lastUpdated`         | Timestamp (ms) of the last successful persist          |
| `load()`              | Load from localStorage and enrich all objects          |
| `startSync()`         | Subscribe to cross-tab storage events, returns cleanup |
| `clear()`             | Wipe all data and persisted storage, ready state       |
| `updateProfile(data)` | Validate (Zod) and update user profile                 |
| `addPortfolio(data)`  | Add a new portfolio, returns ID                        |
| `exportBackup()`      | JSON string of all data                                |
| `importBackup(json)`  | Import and enrich from JSON string                     |
| `formatNumber(v)` …   | Locale-aware number/currency formatters                |

### PortfolioStore

| Method            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `update(updates)` | Update name, notes, dates, inflation, transfers |
| `delete()`        | Remove portfolio from store                     |

### Usage Example

```typescript
// Update profile (validated by profileSchema before persisting)
appStore.updateProfile({ name: 'John', cash_amount: 5000 })

// Add and work with portfolios
const portfolioId = appStore.addPortfolio({ name: 'Retirement', ... })
const portfolio = appStore.portfolios.find((p) => p.id === portfolioId)
portfolio?.update({ name: 'New Name' })
portfolio?.delete()
```

## Conventions

- Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- Financial calculations must use Decimal.js for precision
- All dates handled through `@snaha/kalkul-maths/date` utilities
- Run `pnpm check` before committing
