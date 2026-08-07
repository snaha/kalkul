<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'

  import { goto } from '$app/navigation'

  import { formatDate } from '$lib/@snaha/kalkul-maths'
  import { getNextAddPlanStepUrl, getPrevAddPlanStepUrl } from '$lib/add-plan-steps'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Textarea } from '$lib/components/ui/textarea'
  import routes from '$lib/routes'
  import type { PlanEndType, PlanStartType } from '$lib/schemas'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  // Generate a default plan name based on existing portfolios
  const uid = $props.id()

  function getDefaultPlanName(): string {
    const existingCount = appStore.portfolios.length
    return $_('page.addPlan.details.defaultName', { values: { index: existingCount + 1 } })
  }

  let name = $state(getDefaultPlanName())
  let notes = $state('')
  let startType = $state<PlanStartType>('now')
  let startYear = $state(String(new Date().getFullYear()))
  let startMonth = $state(String(new Date().getMonth()))
  let endType = $state<PlanEndType>('when_age_is')
  let endAge = $state<number | undefined>(85)
  let endYear = $state('')
  let endMonth = $state('')
  let inflation = $state<number | undefined>(2)

  const years = getYearOptions()
  const months = $derived(getMonthOptions($locale ?? undefined))

  const yearItems = $derived(years.map((y) => ({ value: y, label: y })))
  const startTypeItems = $derived([
    { value: 'now', label: $_('page.addPlan.details.startNow') },
    { value: 'at_specific_date', label: $_('page.addPlan.details.startAtDate') },
  ])
  const endTypeItems = $derived([
    { value: 'when_age_is', label: $_('page.addPlan.details.endWhenAgeIs') },
    { value: 'at_specific_date', label: $_('page.addPlan.details.endAtDate') },
  ])

  // Calculate date from start of current month
  function getStartDate(): string {
    if (startType === 'now') {
      const now = new Date()
      return formatDate(new Date(now.getFullYear(), now.getMonth(), 1))
    }
    return formatDate(new Date(Number(startYear), Number(startMonth), 1))
  }

  // Calculate end date based on age or specific date
  function getEndDate(): string {
    if (endType === 'when_age_is' && endAge !== undefined) {
      const birthDate = appStore.profile.birthDate
      if (birthDate) {
        return formatDate(new Date(birthDate.getFullYear() + endAge, birthDate.getMonth(), 1))
      }
      // Fallback: use start year + age
      const startYearNum = startType === 'now' ? new Date().getFullYear() : Number(startYear)
      return formatDate(new Date(startYearNum + endAge, 0, 1))
    }
    if (endYear && endMonth !== '') {
      return formatDate(new Date(Number(endYear), Number(endMonth), 1))
    }
    // Fallback (unreachable due to canContinue validation)
    return formatDate(new Date(new Date().getFullYear() + 30, 0, 1))
  }

  let canContinue = $derived(
    name.trim().length > 0 &&
      inflation !== undefined &&
      (endType === 'when_age_is' || (endYear !== '' && endMonth !== '')),
  )

  function handleBack() {
    // URL is already resolved by getPrevAddPlanStepUrl
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevAddPlanStepUrl(routes.PLAN_ADD_DETAILS, appStore.profile))
  }

  function handleContinue() {
    // Store plan details in sessionStorage for step 3
    const planDetails = {
      name: name.trim(),
      notes: notes.trim() || undefined,
      start_date: getStartDate(),
      end_date: getEndDate(),
      inflation_rate: (inflation ?? 2) / 100,
    }
    sessionStorage.setItem(storageKeys.PLAN_DRAFT, JSON.stringify(planDetails))
    // URL is already resolved by getNextAddPlanStepUrl
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextAddPlanStepUrl(routes.PLAN_ADD_DETAILS, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col gap-8">
  <div class="flex flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold">{$_('page.addPlan.details.title')}</h1>
    <p class="text-base">{$_('page.addPlan.details.description')}</p>
  </div>

  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for="plan-name">{$_('page.addPlan.details.planName')}</Label>
      <Input id="plan-name" bind:value={name} />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="plan-notes">{$_('page.addPlan.details.notes')}</Label>
      <Textarea
        id="plan-notes"
        placeholder={$_('page.addPlan.details.notesPlaceholder')}
        bind:value={notes}
        class="min-h-16 resize-none"
      />
    </div>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-start">{$_('page.addPlan.details.start')}</Label>
        <SelectField
          id="{uid}-start"
          value={startType}
          items={startTypeItems}
          onValueChange={(v) => (startType = v as PlanStartType)}
        />
      </div>
      {#if startType === 'at_specific_date'}
        <div class="flex flex-1 items-end gap-2">
          <SelectField
            bind:value={startYear}
            items={yearItems}
            aria-label={$_('page.setup.aboutYou.selectYear')}
            class="w-24"
          />
          <SelectField
            bind:value={startMonth}
            items={months}
            aria-label={$_('page.setup.aboutYou.selectMonth')}
            class="flex-1"
          />
        </div>
      {/if}
    </div>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-end">{$_('page.addPlan.details.end')}</Label>
        <SelectField
          id="{uid}-end"
          value={endType}
          items={endTypeItems}
          onValueChange={(v) => (endType = v as PlanEndType)}
        />
      </div>
      {#if endType === 'when_age_is'}
        <div class="flex flex-1">
          <SuffixedInput
            value={endAge}
            aria-label={$_('page.addPlan.details.endWhenAgeIs')}
            suffix={$_('page.addPlan.details.yearsOld')}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (endAge = v)}
          />
        </div>
      {:else}
        <div class="flex flex-1 items-end gap-2">
          <SelectField
            bind:value={endYear}
            items={yearItems}
            placeholder={$_('page.setup.aboutYou.selectYear')}
            aria-label={$_('page.setup.aboutYou.selectYear')}
            class="w-24"
          />
          <SelectField
            bind:value={endMonth}
            items={months}
            placeholder={$_('page.setup.aboutYou.selectMonth')}
            aria-label={$_('page.setup.aboutYou.selectMonth')}
            class="flex-1"
          />
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-2">
      <Label for="{uid}-inflation">{$_('page.addPlan.details.inflation')}</Label>
      <SuffixedInput
        id="{uid}-inflation"
        value={inflation}
        suffix="%"
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => (inflation = v)}
      />
    </div>
  </div>

  <div class="flex items-center gap-4">
    <Button variant="ghost" onclick={handleBack}>
      {$_('page.addPlan.back')}
    </Button>
    <div class="flex flex-1 justify-end">
      <Button disabled={!canContinue} onclick={handleContinue}>
        {$_('page.addPlan.continue')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
