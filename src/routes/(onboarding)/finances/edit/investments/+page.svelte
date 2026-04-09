<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import routes from '$lib/routes'
  import type { ProfileInvestment } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatCurrency } from '$lib/utils'

  interface InvestmentUI {
    id: string
    name: string
    balance: string
    apy: string
    editing: boolean
    editingName: boolean
    showAdvanced: boolean
  }

  function storedToUI(stored: ProfileInvestment[]): InvestmentUI[] {
    return stored.map((inv) => ({
      id: inv.id,
      name: inv.name,
      balance: inv.balance > 0 ? String(inv.balance) : '',
      apy: inv.apy > 0 ? String(inv.apy) : '',
      editing: false,
      editingName: false,
      showAdvanced: false,
    }))
  }

  let investments = $state<InvestmentUI[]>([])
  let investmentCounter = $state(0)
  let loaded = $state(false)

  $effect(() => {
    const stored = appStore.profile.investments
    if (!loaded && stored && stored.length > 0) {
      investments = storedToUI(stored)
      investmentCounter = investments.length
      loaded = true
    }
  })

  let canContinue = $derived(
    investments.some((i) => i.balance.trim().length > 0 && Number(i.balance) > 0),
  )

  let currencyLabel = $derived(appStore.profile.currency || 'EUR')

  function addInvestment() {
    investmentCounter++
    for (const inv of investments) {
      inv.editing = false
    }
    investments.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.investments.defaultName', { values: { index: investmentCounter } }),
      balance: '',
      apy: '',
      editing: true,
      editingName: false,
      showAdvanced: false,
    })
  }

  function duplicateInvestment(investment: InvestmentUI) {
    investmentCounter++
    const idx = investments.indexOf(investment)
    const copy: InvestmentUI = {
      ...investment,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: investment.name } }),
      editing: true,
      editingName: false,
    }
    investments.splice(idx + 1, 0, copy)
  }

  function deleteInvestment(investment: InvestmentUI) {
    const idx = investments.indexOf(investment)
    if (idx !== -1) investments.splice(idx, 1)
  }

  function formatBalance(balance: string): string {
    const num = Number(balance)
    if (!num) return ''
    return formatCurrency(num, currencyLabel)
  }

  function saveInvestments() {
    const data: ProfileInvestment[] = investments
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        balance: Number(i.balance) || 0,
        apy: Number(i.apy) || 0,
      }))
    appStore.updateProfile({ investments: data })
  }

  function nextStep() {
    if (appStore.profile.has_tangible_assets) return routes.FINANCES_EDIT_TANGIBLE_ASSETS
    if (appStore.profile.has_liabilities) return routes.FINANCES_EDIT_LIABILITIES
    return routes.FINANCES_EDIT_INCOME
  }

  function handleContinue() {
    saveInvestments()
    goto(resolve(nextStep()))
  }

  function handleSkip() {
    goto(resolve(nextStep()))
  }

  function handleBack() {
    goto(resolve(routes.FINANCES_EDIT))
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
        colorDot="bg-chart-2"
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
                oninput={(e) => {
                  investment.balance = (e.currentTarget as HTMLInputElement).value
                }}
              />
            </div>
            <div class="flex w-32 flex-col gap-2">
              <Label>{$_('page.setup.investments.apy')}</Label>
              <SuffixedInput
                value={investment.apy}
                suffix="%"
                oninput={(e) => {
                  investment.apy = (e.currentTarget as HTMLInputElement).value
                }}
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Switch
              checked={investment.showAdvanced}
              onCheckedChange={(v) => {
                investment.showAdvanced = v === true
              }}
            />
            <span class="text-sm font-medium">
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
