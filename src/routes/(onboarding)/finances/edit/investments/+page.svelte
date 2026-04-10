<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import type { ProfileInvestment } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented } from '$lib/utils'

  interface InvestmentUI {
    id: string
    name: string
    balance: number | undefined
    apy: number | undefined
    editing: boolean
    editingName: boolean
  }

  function storedToUI(stored: ProfileInvestment[]): InvestmentUI[] {
    return stored.map((inv) => ({
      id: inv.id,
      name: inv.name,
      balance: inv.balance > 0 ? inv.balance : undefined,
      apy: inv.apy > 0 ? inv.apy : undefined,
      editing: false,
      editingName: false,
    }))
  }

  let investments = $state<InvestmentUI[]>([])
  let investmentCounter = $state(0)
  let hydrated = $state(false)

  $effect(() => {
    if (hydrated || appStore.loading) return
    const stored = appStore.profile.investments
    if (stored && stored.length > 0) {
      investments = storedToUI(stored)
      investmentCounter = investments.length
    }
    hydrated = true
  })

  let canContinue = $derived(investments.some((i) => (i.balance ?? 0) > 0))

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function addInvestment() {
    investmentCounter++
    for (const inv of investments) inv.editing = false
    investments.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.investments.defaultName', { values: { index: investmentCounter } }),
      balance: undefined,
      apy: undefined,
      editing: true,
      editingName: false,
    })
  }

  function duplicateInvestment(investment: InvestmentUI) {
    investmentCounter++
    const idx = investments.indexOf(investment)
    investments.splice(idx + 1, 0, {
      ...investment,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: investment.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteInvestment(investment: InvestmentUI) {
    const idx = investments.indexOf(investment)
    if (idx !== -1) investments.splice(idx, 1)
  }

  function formatBalance(balance: number | undefined): string {
    if (balance === undefined || balance === 0) return ''
    return appStore.formatCurrency(balance)
  }

  function saveInvestments() {
    const data: ProfileInvestment[] = investments
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        balance: i.balance ?? 0,
        apy: i.apy ?? 0,
      }))
    appStore.updateProfile({
      investments: data,
      has_investments: data.length > 0,
    })
  }

  function handleContinue() {
    saveInvestments()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_INVESTMENTS, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_INVESTMENTS, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_INVESTMENTS, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.investments.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.investments.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each investments as investment (investment.id)}
      <EditableItemCard
        item={investment}
        collapsedValue={formatBalance(investment.balance)}
        dotColor={CATEGORY_COLORS.investments[0]}
        onToggleEditing={() => {
          investment.editing = !investment.editing
        }}
        onDuplicate={() => duplicateInvestment(investment)}
        onDelete={() => deleteInvestment(investment)}
        onStartEditingName={() => {
          investment.editingName = true
        }}
        onStopEditingName={() => {
          investment.editingName = false
        }}
      >
        {#snippet expandedContent()}
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.investments.currentBalance')}</Label>
              <SuffixedInput
                value={investment.balance}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  investment.balance = v
                }}
              />
            </div>
            <div class="flex w-32 flex-col gap-2">
              <Label>{$_('page.setup.investments.apy')}</Label>
              <SuffixedInput
                value={investment.apy}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  investment.apy = v
                }}
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Switch checked={false} onCheckedChange={notImplemented} />
            <span class="text-sm font-medium text-muted-foreground">
              {$_('page.setup.common.advancedOptions')}
            </span>
          </div>
        {/snippet}
      </EditableItemCard>
    {/each}

    <div>
      <Button variant="secondary" onclick={addInvestment}>
        <Plus class="size-4" />
        {$_('page.setup.investments.addInvestment')}
      </Button>
    </div>
  </div>

  <OnboardingNav
    {canContinue}
    onBack={handleBack}
    onSkip={handleSkip}
    onContinue={handleContinue}
  />
</div>
