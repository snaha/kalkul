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
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select'
  import { Switch } from '$lib/components/ui/switch'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import type { Frequency, ProfileLiability } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented } from '$lib/utils'

  interface LiabilityUI {
    id: string
    name: string
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    editing: boolean
    editingName: boolean
  }

  function storedToUI(stored: ProfileLiability[]): LiabilityUI[] {
    return stored.map((l) => ({
      id: l.id,
      name: l.name,
      outstanding_balance: l.outstanding_balance > 0 ? l.outstanding_balance : undefined,
      installment_frequency: l.installment_frequency,
      annual_rate: l.annual_rate > 0 ? l.annual_rate : undefined,
      installment_amount: l.installment_amount > 0 ? l.installment_amount : undefined,
      remaining_term: l.remaining_term > 0 ? l.remaining_term : undefined,
      editing: false,
      editingName: false,
    }))
  }

  let liabilities = $state<LiabilityUI[]>([])
  let liabilityCounter = $state(0)
  let hydrated = $state(false)

  $effect(() => {
    if (hydrated || appStore.loading) return
    const stored = appStore.profile.liabilities
    if (stored && stored.length > 0) {
      liabilities = storedToUI(stored)
      liabilityCounter = liabilities.length
    }
    hydrated = true
  })

  let canContinue = $derived(liabilities.some((l) => (l.outstanding_balance ?? 0) > 0))

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function addLiability() {
    liabilityCounter++
    for (const l of liabilities) l.editing = false
    liabilities.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.liabilities.defaultName', { values: { index: liabilityCounter } }),
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      editing: true,
      editingName: false,
    })
  }

  function duplicateLiability(liability: LiabilityUI) {
    liabilityCounter++
    const idx = liabilities.indexOf(liability)
    liabilities.splice(idx + 1, 0, {
      ...liability,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: liability.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteLiability(liability: LiabilityUI) {
    const idx = liabilities.indexOf(liability)
    if (idx !== -1) liabilities.splice(idx, 1)
  }

  function formatBalance(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrency(val)
  }

  function frequencyLabel(f: Frequency): string {
    if (f === 'yearly') return $_('page.setup.common.yearly')
    if (f === 'weekly') return $_('page.setup.common.weekly')
    return $_('page.setup.common.monthly')
  }

  function saveLiabilities() {
    const data: ProfileLiability[] = liabilities
      .filter((l) => l.name.trim().length > 0)
      .map((l) => ({
        id: l.id,
        name: l.name,
        outstanding_balance: l.outstanding_balance ?? 0,
        installment_frequency: l.installment_frequency,
        annual_rate: l.annual_rate ?? 0,
        installment_amount: l.installment_amount ?? 0,
        remaining_term: l.remaining_term ?? 0,
      }))
    appStore.updateProfile({
      liabilities: data,
      has_liabilities: data.length > 0,
    })
  }

  function handleContinue() {
    saveLiabilities()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_LIABILITIES, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_LIABILITIES, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_LIABILITIES, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.liabilities.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.liabilities.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each liabilities as liability, idx (liability.id)}
      <EditableItemCard
        item={liability}
        collapsedValue={formatBalance(liability.outstanding_balance)}
        dotColor={CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length]}
        onToggleEditing={() => {
          liability.editing = !liability.editing
        }}
        onDuplicate={() => duplicateLiability(liability)}
        onDelete={() => deleteLiability(liability)}
        onStartEditingName={() => {
          liability.editingName = true
        }}
        onStopEditingName={() => {
          liability.editingName = false
        }}
      >
        {#snippet expandedContent()}
          <div class="flex flex-col gap-2">
            <Label>{$_('page.setup.liabilities.outstandingBalance')}</Label>
            <SuffixedInput
              value={liability.outstanding_balance}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => {
                liability.outstanding_balance = v
              }}
            />
          </div>

          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.liabilities.installmentFrequency')}</Label>
              <Select
                type="single"
                value={liability.installment_frequency}
                onValueChange={(v) => {
                  liability.installment_frequency = v as Frequency
                }}
              >
                <SelectTrigger class="h-8">
                  {frequencyLabel(liability.installment_frequency)}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{$_('page.setup.common.monthly')}</SelectItem>
                  <SelectItem value="yearly">{$_('page.setup.common.yearly')}</SelectItem>
                  <SelectItem value="weekly">{$_('page.setup.common.weekly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.liabilities.annualRate')}</Label>
              <SuffixedInput
                value={liability.annual_rate}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  liability.annual_rate = v
                }}
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.liabilities.installmentAmount')}</Label>
              <SuffixedInput
                value={liability.installment_amount}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  liability.installment_amount = v
                }}
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.liabilities.remainingTerm')}</Label>
              <SuffixedInput
                value={liability.remaining_term}
                suffix={$_('page.setup.liabilities.years')}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  liability.remaining_term = v
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
      <Button variant="secondary" onclick={addLiability}>
        <Plus class="size-4" />
        {$_('page.setup.liabilities.addLiability')}
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
