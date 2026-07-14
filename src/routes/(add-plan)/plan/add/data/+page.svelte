<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { SvelteSet } from 'svelte/reactivity'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { getPrevAddPlanStepUrl } from '$lib/add-plan-steps'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import routes from '$lib/routes'
  import { type PlanDraft, planDraftSchema } from '$lib/schemas'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'

  // State for included items - all checked by default
  let includeCash = $state(true)
  let includeInvestments = $state(true)
  let includeTangibleAssets = $state(true)
  let includeLiabilities = $state(true)
  let includeIncomes = $state(true)
  let includeExpenses = $state(true)

  // Individual item selections (SvelteSet is already reactive, no $state needed)
  let selectedInvestmentIds = new SvelteSet((appStore.profile.investments ?? []).map((i) => i.id))
  let selectedTangibleAssetIds = new SvelteSet(
    (appStore.profile.tangible_assets ?? []).map((a) => a.id),
  )
  let selectedLiabilityIds = new SvelteSet((appStore.profile.liabilities ?? []).map((l) => l.id))
  let selectedIncomeIds = new SvelteSet((appStore.profile.incomes ?? []).map((i) => i.id))
  let selectedExpenseIds = new SvelteSet((appStore.profile.expenses ?? []).map((e) => e.id))

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
    includeCash &&
      includeInvestments &&
      includeTangibleAssets &&
      includeLiabilities &&
      includeIncomes &&
      includeExpenses,
  )

  function selectAll() {
    includeCash = true
    includeInvestments = true
    includeTangibleAssets = true
    includeLiabilities = true
    includeIncomes = true
    includeExpenses = true
    // Clear and refill SvelteSet (mutate in place)
    selectedInvestmentIds.clear()
    for (const i of appStore.profile.investments ?? []) selectedInvestmentIds.add(i.id)
    selectedTangibleAssetIds.clear()
    for (const a of appStore.profile.tangible_assets ?? []) selectedTangibleAssetIds.add(a.id)
    selectedLiabilityIds.clear()
    for (const l of appStore.profile.liabilities ?? []) selectedLiabilityIds.add(l.id)
    selectedIncomeIds.clear()
    for (const i of appStore.profile.incomes ?? []) selectedIncomeIds.add(i.id)
    selectedExpenseIds.clear()
    for (const e of appStore.profile.expenses ?? []) selectedExpenseIds.add(e.id)
  }

  function deselectAll() {
    includeCash = false
    includeInvestments = false
    includeTangibleAssets = false
    includeLiabilities = false
    includeIncomes = false
    includeExpenses = false
    // Clear all SvelteSet (mutate in place)
    selectedInvestmentIds.clear()
    selectedTangibleAssetIds.clear()
    selectedLiabilityIds.clear()
    selectedIncomeIds.clear()
    selectedExpenseIds.clear()
  }

  function handleBack() {
    // URL is already resolved by getPrevAddPlanStepUrl
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevAddPlanStepUrl(routes.PLAN_ADD_DATA, appStore.profile))
  }

  function handleCreatePlan() {
    // Load plan details from sessionStorage
    const draftStr = sessionStorage.getItem(storageKeys.PLAN_DRAFT)
    if (!draftStr) {
      // Fallback if no draft
      goto(resolve(routes.HOME))
      return
    }

    // Validate the draft instead of blind-casting: a corrupted or outdated
    // draft would otherwise flow unchecked into addPortfolio and make the
    // Create button throw. On failure, drop it and return to the details
    // step so the user can re-enter the plan basics.
    let draft: PlanDraft | undefined
    try {
      draft = planDraftSchema.parse(JSON.parse(draftStr))
    } catch (e) {
      console.error('Discarding unparseable plan draft', e)
    }
    if (!draft) {
      sessionStorage.removeItem(storageKeys.PLAN_DRAFT)
      // URL is already resolved by getPrevAddPlanStepUrl
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      goto(getPrevAddPlanStepUrl(routes.PLAN_ADD_DATA, appStore.profile))
      return
    }

    // Create the portfolio with included references
    // When category is checked: include all items; when unchecked: include only selected items
    const portfolioId = appStore.addPortfolio({
      name: draft.name,
      notes: draft.notes,
      start_date: draft.start_date,
      end_date: draft.end_date,
      inflation_rate: draft.inflation_rate,
      include_cash: includeCash,
      included_investment_ids: includeInvestments
        ? (appStore.profile.investments ?? []).map((i) => i.id)
        : Array.from(selectedInvestmentIds),
      included_tangible_asset_ids: includeTangibleAssets
        ? (appStore.profile.tangible_assets ?? []).map((a) => a.id)
        : Array.from(selectedTangibleAssetIds),
      included_liability_ids: includeLiabilities
        ? (appStore.profile.liabilities ?? []).map((l) => l.id)
        : Array.from(selectedLiabilityIds),
      included_income_ids: includeIncomes
        ? (appStore.profile.incomes ?? []).map((i) => i.id)
        : Array.from(selectedIncomeIds),
      included_expense_ids: includeExpenses
        ? (appStore.profile.expenses ?? []).map((e) => e.id)
        : Array.from(selectedExpenseIds),
    })

    // Clean up
    sessionStorage.removeItem(storageKeys.PLAN_DRAFT)

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
        <Checkbox id="include-cash" bind:checked={includeCash} />
        <Label for="include-cash" class="cursor-pointer text-sm font-medium">
          {$_('page.addPlan.data.includeCash')}
        </Label>
      </div>
    {/if}

    <!-- Include investments -->
    {#if hasInvestments}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Checkbox id="include-investments" bind:checked={includeInvestments} />
          <Label for="include-investments" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeInvestments')}
          </Label>
        </div>
        {#if !includeInvestments}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.investments ?? [] as investment (investment.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`inv-${investment.id}`}
                    checked={selectedInvestmentIds.has(investment.id)}
                    onCheckedChange={() => toggleItem(selectedInvestmentIds, investment.id)}
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
          <Checkbox id="include-tangible-assets" bind:checked={includeTangibleAssets} />
          <Label for="include-tangible-assets" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeTangibleAssets')}
          </Label>
        </div>
        {#if !includeTangibleAssets}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.tangible_assets ?? [] as asset (asset.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`asset-${asset.id}`}
                    checked={selectedTangibleAssetIds.has(asset.id)}
                    onCheckedChange={() => toggleItem(selectedTangibleAssetIds, asset.id)}
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
          <Checkbox id="include-liabilities" bind:checked={includeLiabilities} />
          <Label for="include-liabilities" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeLiabilities')}
          </Label>
        </div>
        {#if !includeLiabilities}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.liabilities ?? [] as liability (liability.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`liability-${liability.id}`}
                    checked={selectedLiabilityIds.has(liability.id)}
                    onCheckedChange={() => toggleItem(selectedLiabilityIds, liability.id)}
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
          <Checkbox id="include-incomes" bind:checked={includeIncomes} />
          <Label for="include-incomes" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeIncomes')}
          </Label>
        </div>
        {#if !includeIncomes}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.incomes ?? [] as income (income.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`income-${income.id}`}
                    checked={selectedIncomeIds.has(income.id)}
                    onCheckedChange={() => toggleItem(selectedIncomeIds, income.id)}
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
          <Checkbox id="include-expenses" bind:checked={includeExpenses} />
          <Label for="include-expenses" class="cursor-pointer text-sm font-medium">
            {$_('page.addPlan.data.includeExpenses')}
          </Label>
        </div>
        {#if !includeExpenses}
          <div class="ml-2 flex gap-2">
            <Separator orientation="vertical" class="h-auto" />
            <div class="flex flex-col gap-2 py-1">
              {#each appStore.profile.expenses ?? [] as expense (expense.id)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id={`expense-${expense.id}`}
                    checked={selectedExpenseIds.has(expense.id)}
                    onCheckedChange={() => toggleItem(selectedExpenseIds, expense.id)}
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
    <Button variant="secondary" size="sm" onclick={selectAll} disabled={allSelected}>
      {$_('page.addPlan.data.selectAll')}
    </Button>
    <Button variant="secondary" size="sm" onclick={deselectAll} disabled={!allSelected}>
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
