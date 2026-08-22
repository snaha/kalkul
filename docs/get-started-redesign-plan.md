# Get-Started Redesign — Execution Plan

## Objective

Ship the Figma v4 GET STARTED flow (file `u1YcZl99L5kTD128oxU1Nt`, section node `841:4030`) **exactly as designed**, and land the already-written app-side transfers pages in the same branch.

## Context

- Branch: `feat/get-started-redesign` (1 commit ahead of main: `20c6d444` "feat: redesign get-started flow and move transfers to the profile").
- The onboarding flow itself is **already implemented and Figma-faithful**: 8 steps (`The basics` → `Current finances` → conditional `Investments`/`Tangible assets`/`Liabilities` → `Recurring income` → `Recurring expenses` → `Recurring transfers` with final `Done`), shared header (`Get started` + `Progress` + X), `OnboardingNav`, empty+filled card states, language selector, license-terms checkbox, import-file link, live-age hint.
- **Uncommitted (in working tree)** app-side transfers integration: `src/routes/(app)/financial-data/transfers/+page.svelte`, edits to `financial-data-sidebar.svelte`, `financial-data-nav.ts`, `routes.ts`, and `src/routes/(add-plan)/plan/add/data/+page.svelte` (include-transfers selection).
- Untracked `docs/*.md` strategy files are unrelated → **leave out of the branch**.

## User Decisions

1. App-side transfer pages **are part of this branch** (commit them).
2. Make everything **exactly as Figma**.
3. Untracked `docs/*.md` files are **excluded** from the branch.

## Work Items

### A. Add missing i18n keys (both `en.json` and `cs.json`) — required so `check-locales` passes

| Key                                        | EN                                                                                                          | CS                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `page.financialData.nav.transfers`         | `Transfers`                                                                                                 | `Převody`                                                                                      |
| `page.financialData.transfers.title`       | `Transfers`                                                                                                 | `Převody`                                                                                      |
| `page.financialData.transfers.description` | `Regular deposits or withdrawals between your accounts and assets — like monthly investment contributions.` | `Pravidelné vklady nebo výběry mezi vašimi účty a aktivy — jako měsíční investiční příspěvky.` |
| `page.addPlan.data.includeTransfers`       | `Include all transfers`                                                                                     | `Zahrnout všechny převody`                                                                     |

### B. Align step-1 copy to Figma (Name placeholder)

- `page.setup.aboutYou.namePlaceholder`: EN `What should we call you?` → **`Your name`**; CS `Jak vám máme říkat?` → **`Vaše jméno`**.

### C. Unit tests (non-UI logic, per AGENTS.md TDD)

1. **`src/lib/onboarding-steps.test.ts` (new)**:
   - `getOnboardingSteps` conditional insertion: steps include investments/tangible-assets/liabilities when `has_*` flag is true OR items exist; omitted otherwise.
   - `getNextStepUrl` on final step falls back to `routes.HOME`; walks forward correctly with optional steps present.
   - `getPrevStepUrl` on first step falls back to `HOME`.
2. **`routes.test.ts`**: add `FINANCIAL_DATA_TRANSFERS` route-id assertion (mirror existing pattern).

### D. Required files that exist and the snapshot of current app-side transfer work

Commit the app-side transfers work (conventional commits), **excluding** `docs/*.md`:

- `src/routes/(app)/financial-data/transfers/+page.svelte` (new, renders `TransfersEditor`)
- `src/lib/components/financial-data-sidebar.svelte` (adds transfers nav entry)
- `src/lib/financial-data-nav.ts` + `src/lib/routes.ts` (transfers route constant + union case)
- `src/routes/(add-plan)/plan/add/data/+page.svelte` (include-transfers selection)
- `src/lib/locales/{en,cs}.json` (keys from A) + step-1 copy (B)

Suggested 2 commits:

1. `feat: finish transfers pages in financial data and add-plan data selection` (app-side files + routes/nav + the add-plan data keys)
2. `fix: match step-1 name placeholder to the Figma spec` (copy-only)

### E. Verification (before commit)

- `pnpm format` → `pnpm lint` → `pnpm check` → `pnpm knip` → `pnpm check-locales` (fix ALL findings)
- `pnpm test:unit run` (all green; confirm new tests pass)
- Full `pnpm check:all`

### F. Figma fidelity checklist (verify against spec, don't redo)

- Header: title "Get started", centered 128px `Progress`, ghost-icon X → Home.
- Step cards (content area `max-w-[576px]`, gap-8, title `text-xl font-bold`, desc `text-base`), right-aligned `Continue`/`Done` via `OnboardingNav`.
- `The basics`: Name (placeholder "Your name"), DOB year+month with live-age hint; Location (flex-1) + Currency (w-24) row; Language; terms checkbox opening `LicenseDialog`; import link opening `ImportDialog`.
- `Current finances`: suffixed cash input + helper; 3 `CheckboxCard`s; nav.
- List steps: editor cards + `secondary` "Add …" button; `Recurring transfers` shows From/To selects, Amount+Frequency, `Adjust for inflation` switch + help, final **Done**.

## Out of Scope

- `docs/*.md` strategy notes (leave untracked).
- Any edit to the already-faithful onboarding flow beyond the copy fix in B (verify only).
