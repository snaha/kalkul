<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { SvelteSet } from 'svelte/reactivity'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { getPrevAddPlanStepUrl } from '$lib/add-plan-steps'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { buildPlanCreationFields } from '$lib/plan-draft'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { planDraftStore as draft } from '$lib/stores/plan-draft.svelte'

  // Helper to toggle individual item (mutates the set directly since SvelteSet is reactive)
  function toggleItem(set: SvelteSet<string>, id: string): void {
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
  }

  // Check if any selections exist
  const hasInvestments = $derived((appStore.profile.investments ?? []).length > 0)
  const hasTangibleAssets = $derived((appStore.profile.tangible_assets ?? []).length > 0)
  const hasLiabilities = $derived((appStore.profile.liabilities ?? []).length > 0)
  const hasIncomes = $derived((appStore.profile.incomes ?? []).length > 0)
  const hasExpenses = $derived((appStore.profile.expenses ?? []).length > 0)
  const hasCash = $derived((appStore.profile.cash_amount ?? 0) > 0)

  // Check if all items are selected
  const allSelected = $derived(
    draft.includeCash &&
      draft.includeInvestments &&
      draft.includeTangibleAssets &&
      draft.includeLiabilities &&
      draft.includeIncomes &&
      draft.includeExpenses,
  )

  function handleBack() {
    // URL is already resolved by getPrevAddPlanStepUrl
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevAddPlanStepUrl(routes.PLAN_ADD_DATA, appStore.profile))
  }

  function handleCreatePlan() {
    // Create the portfolio with included references from the shared draft.
    // When category is checked: include all items; when unchecked: include only selected items
    const portfolioId = appStore.addPortfolio({
      ...buildPlanCreationFields(draft, appStore.profile.birthDate),
      include_cash: draft.includeCash,
      included_investment_ids: draft.includeInvestments
        ? (appStore.profile.investments ?? []).map((i) => i.id)
        : Array.from(draft.selectedInvestmentIds),
      included_tangible_asset_ids: draft.includeTangibleAssets
        ? (appStore.profile.tangible_assets ?? []).map((a) => a.id)
        : Array.from(draft.selectedTangibleAssetIds),
      included_liability_ids: draft.includeLiabilities
        ? (appStore.profile.liabilities ?? []).map((l) => l.id)
        : Array.from(draft.selectedLiabilityIds),
      included_income_ids: draft.includeIncomes
        ? (appStore.profile.incomes ?? []).map((i) => i.id)
        : Array.from(draft.selectedIncomeIds),
      included_expense_ids: draft.includeExpenses
        ? (appStore.profile.expenses ?? []).map((e) => e.id)
        : Array.from(draft.selectedExpenseIds),
    })

    // Navigate to the new plan page
    goto(resolve(`${routes.PLAN_VIEW}/${portfolioId}`))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col gap-8">
  <div class="flex flex-col gap-2">
    <h1 class="text-2xl font-bold text-foreground">{$_('page.addPlan.data.title')}</h1>
    <p class="text-base text-foreground">{$_('page.addPlan.data.description')}</p>
    <p class="text-sm text-muted-foreground">{$_('page.addPlan.data.subDescription')}</p>
  </div>

  <div class="flex flex-col gap-4">
    <!-- Include current cash -->
    {#if hasCash}
      <div class="flex items-center gap-2">
        <Checkbox id="include-cash" bind:checked={draft.includeCash} />
        <Label for="include-cash" class="cursor-pointer text-sm font-medium">
          {$_('page.addPlan.data.includeCash')}
        </Label>
      </div>
    {/if}

    <!-- Include investments -->
    {#if hasInvestments}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Checkbox id="include-investments" bind:checked={draft.includeInvestments} />
          <Label for="include-investments" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeInvestments')}
          </Label>
        </div>
        {#if !draft.includeInvestments}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.investments ?? [] as investment (investment.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`inv-${investment.id}`}
                    checked={draft.selectedInvestmentIds.has(investment.id)}
                    onCheckedChange={() => toggleItem(draft.selectedInvestmentIds, investment.id)}
                  />
                  <Label for={`inv-${investment.id}`} class="cursor-pointer text-sm">
                    {investment.name}
                  </Label>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Include tangible assets -->
    {#if hasTangibleAssets}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Checkbox id="include-tangible-assets" bind:checked={draft.includeTangibleAssets} />
          <Label for="include-tangible-assets" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeTangibleAssets')}
          </Label>
        </div>
        {#if !draft.includeTangibleAssets}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.tangible_assets ?? [] as asset (asset.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`asset-${asset.id}`}
                    checked={draft.selectedTangibleAssetIds.has(asset.id)}
                    onCheckedChange={() => toggleItem(draft.selectedTangibleAssetIds, asset.id)}
                  />
                  <Label for={`asset-${asset.id}`} class="cursor-pointer text-sm">
                    {asset.name}
                  </Label>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Include liabilities -->
    {#if hasLiabilities}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Checkbox id="include-liabilities" bind:checked={draft.includeLiabilities} />
          <Label for="include-liabilities" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeLiabilities')}
          </Label>
        </div>
        {#if !draft.includeLiabilities}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.liabilities ?? [] as liability (liability.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`liability-${liability.id}`}
                    checked={draft.selectedLiabilityIds.has(liability.id)}
                    onCheckedChange={() => toggleItem(draft.selectedLiabilityIds, liability.id)}
                  />
                  <Label for={`liability-${liability.id}`} class="cursor-pointer text-sm">
                    {liability.name}
                  </Label>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Include incomes -->
    {#if hasIncomes}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Checkbox id="include-incomes" bind:checked={draft.includeIncomes} />
          <Label for="include-incomes" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeIncomes')}
          </Label>
        </div>
        {#if !draft.includeIncomes}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.incomes ?? [] as income (income.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`income-${income.id}`}
                    checked={draft.selectedIncomeIds.has(income.id)}
                    onCheckedChange={() => toggleItem(draft.selectedIncomeIds, income.id)}
                  />
                  <Label for={`income-${income.id}`} class="cursor-pointer text-sm">
                    {income.name}
                  </Label>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Include expenses -->
    {#if hasExpenses}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Checkbox id="include-expenses" bind:checked={draft.includeExpenses} />
          <Label for="include-expenses" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeExpenses')}
          </Label>
        </div>
        {#if !draft.includeExpenses}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.expenses ?? [] as expense (expense.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`expense-${expense.id}`}
                    checked={draft.selectedExpenseIds.has(expense.id)}
                    onCheckedChange={() => toggleItem(draft.selectedExpenseIds, expense.id)}
                  />
                  <Label for={`expense-${expense.id}`} class="cursor-pointer text-sm">
                    {expense.name}
                  </Label>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Select all / Deselect all buttons -->
  <div class="flex items-center gap-2">
    <Button
      variant="secondary"
      size="sm"
      onclick={() => draft.selectAll(appStore.profile)}
      disabled={allSelected}
    >
      {$_('page.addPlan.data.selectAll')}
    </Button>
    <Button
      variant="secondary"
      size="sm"
      onclick={() => draft.deselectAll()}
      disabled={!allSelected}
    >
      {$_('page.addPlan.data.deselectAll')}
    </Button>
  </div>

  <div class="flex items-center gap-4">
    <Button variant="ghost" onclick={handleBack}>
      {$_('page.addPlan.back')}
    </Button>
    <div class="flex flex-1 justify-end">
      <Button onclick={handleCreatePlan}>
        {$_('page.addPlan.createPlan')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
