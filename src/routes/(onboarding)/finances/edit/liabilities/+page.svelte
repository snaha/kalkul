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
  import type { Frequency } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { type LiabilityUI, onboardingDraft as draft } from '$lib/stores/onboarding-draft.svelte'
  import { notImplemented } from '$lib/utils'

  let canContinue = $derived(draft.liabilities.some((l) => (l.outstanding_balance ?? 0) > 0))

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function addLiability() {
    draft.liabilityCounter++
    for (const l of draft.liabilities) l.editing = false
    draft.liabilities.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.liabilities.defaultName', { values: { index: draft.liabilityCounter } }),
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
    draft.liabilityCounter++
    const idx = draft.liabilities.indexOf(liability)
    draft.liabilities.splice(idx + 1, 0, {
      ...liability,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: liability.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteLiability(liability: LiabilityUI) {
    const idx = draft.liabilities.indexOf(liability)
    if (idx !== -1) draft.liabilities.splice(idx, 1)
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

  function handleContinue() {
    draft.commitLiabilities()
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
    {#each draft.liabilities as liability (liability.id)}
      <EditableItemCard
        item={liability}
        collapsedValue={formatBalance(liability.outstanding_balance)}
        dotColor={CATEGORY_COLORS.liabilities[0]}
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
