# UI Migration: Diete → shadcn-svelte

Figma: https://www.figma.com/design/Ai4LMMQvVqdvHIzNUzj5Fs/Kalkul_v4--Copy-?m=dev

## Overview

Complete UI overhaul. New information architecture ("Current finances" + "Plans" instead of portfolios). Hard cut — nuke all existing UI, build fresh with shadcn-svelte.

### What stays (business logic)

- `src/lib/@snaha/` — financial calculations & calculators
- `src/lib/stores/*.svelte.ts` — all state management (except `layout.svelte.ts`)
- `src/lib/schemas.ts`, `src/lib/types.ts` — Zod schemas & types
- `src/lib/locales/` — i18n translations
- `src/lib/colors.ts` — series colors
- `src/lib/random.ts` + test
- `src/lib/components/ui/input/formatted-number/logic.ts` + `events.ts` + tests (move out first)
- `static/fonts/` — Reddit Sans
- Dependencies: `decimal.js`, `date-fns`, `zod`, `svelte-i18n`, `@castlenine/svelte-qrcode`

---

## Phase 0: Foundation Setup

**Goal**: Clean slate — Tailwind + shadcn-svelte compiling, app shows blank shell.

- [ ] Move `src/lib/components/ui/input/formatted-number/logic.ts`, `events.ts`, `store.svelte.ts`, and `*.test.ts` to `src/lib/formatted-number/`
- [ ] Delete `src/lib/components/` entirely
- [ ] Delete `src/lib/css-vars.ts`
- [ ] Delete `src/lib/chart-utils.ts`
- [ ] Delete `src/lib/graph.ts`
- [ ] Delete `src/lib/utils.ts` (shadcn will create its own)
- [ ] Delete `src/lib/stores/layout.svelte.ts`
- [ ] Delete `src/app.pcss`
- [ ] Delete all route pages: everything under `src/routes/(app)/`, `src/routes/dev/`
- [ ] Create stub `src/routes/(app)/+layout.svelte` and `src/routes/(app)/+page.svelte`
- [ ] Install: `pnpm add -D tailwindcss @tailwindcss/vite bits-ui clsx tailwind-merge tailwind-variants lucide-svelte layerchart d3-scale d3-shape`
- [ ] Remove: `pnpm remove carbon-icons-svelte postcss-nesting chart.js`
- [ ] Add `@tailwindcss/vite` plugin to `vite.config.ts`
- [ ] Create `src/app.css` with Tailwind directives + theme tokens
- [ ] Update root `src/routes/+layout.svelte` to import `app.css`
- [ ] Run `pnpm dlx shadcn-svelte@latest init` (standard setup — let it own `src/lib/components/ui/` and `src/lib/utils.ts`)
- [ ] Add shadcn components: `pnpm dlx shadcn-svelte@latest add button input select checkbox dialog dropdown-menu tabs badge tooltip separator slider toggle progress popover calendar collapsible card sheet label chart`
- [ ] Update `postcss.config.mjs` (remove postcss-nesting)
- [ ] Move existing util functions (`formatCurrency`, `formatNumber`, `parseLocalizedNumber`, `formatAge`, `capitalizeFirstLetter`, `asyncTimeout`) from deleted `utils.ts` to a new `src/lib/helpers.ts`
- [ ] Update all imports referencing old `$lib/utils` helpers
- [ ] Update `src/lib/routes.ts` — clear old routes, add stubs for new IA
- [ ] Verify: `pnpm check` passes

---

## Phase 1: App Shell + Theme

**Goal**: Black navbar, dark mode toggle, responsive shell matching Figma.

- [ ] `src/routes/+layout.svelte` — root layout (import app.css, appStore init/sync)
- [ ] `src/routes/(app)/+layout.svelte` — app wrapper with navbar + content slot
- [ ] `src/lib/components/navbar.svelte` — black top bar: Kalkul «K» logo (left), dark mode toggle + 3-dot menu (right)
- [ ] Dark mode: Tailwind `dark:` class strategy, preference stored in localStorage
- [ ] Storage error banner (rewrite with shadcn Alert or similar)
- [ ] Verify: `pnpm dev` shows navbar on blank page

**Figma ref**: nodes `53:3640`, `233:20402` — black navbar visible at top

---

## Phase 2: Home Page + Empty State

**Goal**: Two-column homepage: "Current finances" (doughnut) + "Plans" section.

- [ ] `src/routes/(app)/+page.svelte` — two-column responsive layout
- [ ] Left column: "Current finances" header, doughnut chart (shadcn pie chart / donut with text), net worth summary, "Update" + "View all financial data" links
- [ ] Right column: "Plans" header, "Add plan" button, empty state with illustration + "Make your first plan" CTA
- [ ] Empty state variant (no data): illustration + "See where your money could take you" + "Get started" button
- [ ] Missing data variant: "Current finances" showing warning badge
- [ ] Verify: homepage renders with data from store

**Figma ref**: `53:3640` (empty), `233:20402` (with data), `233:24689` (missing data)

---

## Phase 3: Setup Wizard

**Goal**: Multi-step onboarding flow.

- [ ] `src/routes/(app)/setup/+page.svelte` — wizard container
- [ ] Progress bar at top ("Initial setup ——●———")
- [ ] Step 1 — "About you": Name input, Birthdate (year + month selects), Location select, Currency select
- [ ] Step 2+ — Financial data entry steps (investments, cash, tangible assets, liabilities, incomes, expenses)
- [ ] Advanced details for income/expense: Start (immediately / specific date / age), End, Change over time
- [ ] "Continue →" button, "Skip" option
- [ ] Uses shadcn: Progress, Input, Select, Button, Calendar

**Figma ref**: section `53:3639` — nodes `223:5305` through `233:6637`

---

## Phase 4: Financial Data Detail Pages

**Goal**: "/finances" section with left sidebar navigation.

- [ ] `src/routes/(app)/finances/+layout.svelte` — left sidebar nav + content area
- [ ] Sidebar: Overview, Cash, Investments, Tangible assets, Liabilities, Incomes, Expenses
- [ ] Page header: "← Financial data 📅 YYYY-MM-DD" + "✏️ Update" button
- [ ] `src/routes/(app)/finances/+page.svelte` — overview with doughnut breakdown + net worth history chart
- [ ] `src/routes/(app)/finances/cash/+page.svelte` — cash amount + inline edit
- [ ] `src/routes/(app)/finances/investments/+page.svelte` — investment list cards
- [ ] `src/routes/(app)/finances/tangible-assets/+page.svelte` — asset list cards
- [ ] `src/routes/(app)/finances/liabilities/+page.svelte` — liability list cards
- [ ] `src/routes/(app)/finances/incomes/+page.svelte` — income cards with drag handles, "Add income" button
- [ ] `src/routes/(app)/finances/expenses/+page.svelte` — expense cards, auto-generated from liabilities noted
- [ ] Rebuild formatted-number input: new `src/lib/components/formatted-number-input.svelte` wrapping preserved `logic.ts`/`events.ts` with shadcn Input styling

**Figma ref**: section `89:2933` — `82:4281` (cash), `89:2586` (incomes), `148:5208` (expenses), `89:2766` (investments)

---

## Phase 5: Financial Snapshot Create/Edit

**Goal**: Wizard-style forms for snapshot CRUD.

- [ ] `src/routes/(app)/snapshot/new/+page.svelte` — "New financial snapshot" form
- [ ] `src/routes/(app)/snapshot/[id]/edit/+page.svelte` — "Edit financial snapshot" form
- [ ] Progress bar at top ("Financial update ——●———")
- [ ] Entry date (date picker), cash amount input, continue through categories
- [ ] "Discard changes?" confirmation dialog (shadcn AlertDialog)
- [ ] "Keep editing" / "Discard changes" actions

**Figma ref**: section `262:9630` — `262:6407`, `262:6815`, `262:7852`

---

## Phase 6: Plan Detail View

**Goal**: 3-column layout with projection chart.

- [ ] `src/routes/(app)/plan/[plan_id]/+page.svelte` — main plan view
- [ ] Left column: "Cash flows" / "Assets" tab toggle, search input, collapsible sections (Transfers, Incomes, Expenses), "Add cash flow" button
- [ ] Center: Stacked area chart (shadcn area chart) — Cash, Investments, Tangible assets, Liabilities stacked. "Compare plan" button below.
- [ ] Right column: Year selector (slider), Age display, Net worth breakdown, Key figures (YoY, liquid net worth, income, expenses), Investments value collapsible, Tangible assets value collapsible
- [ ] Chart title: "Stacked net worth" with settings icon
- [ ] Reuse `portfolio-simulation.svelte.ts` for projection calculations

**Figma ref**: `355:7603` (full 3-column view), `355:8817`, related frames in section `89:2933`

---

## Phase 7: Settings + Cleanup

**Goal**: Remaining pages, final cleanup.

- [ ] Settings page (language selector, backup/restore, about)
- [ ] Finalize `src/lib/routes.ts` with all new routes
- [ ] Update i18n: add new labels, remove unused ones for deleted features
- [ ] Run `pnpm check-locales` and fix all issues
- [ ] Run `pnpm knip` and remove orphaned files
- [ ] Update `CLAUDE.md`:
  - Remove all Diete design system references
  - Document shadcn-svelte component usage patterns
  - Update component architecture section
  - Update design system section (shadcn + Tailwind)
  - Update icon library (Lucide instead of Carbon)
- [ ] Run `pnpm check:all` — all checks pass
- [ ] Run `pnpm test:unit run` — all unit tests pass
