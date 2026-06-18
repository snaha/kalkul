<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import { getNextAddPlanStepUrl, getPrevAddPlanStepUrl } from '$lib/add-plan-steps'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Textarea } from '$lib/components/ui/textarea'
  import { loadPlanDraft, savePlanDraft } from '$lib/plan-draft'
  import routes from '$lib/routes'
  import type { PlanEndType, PlanStartType } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, getMonthOptions, getYearOptions } from '$lib/utils'

  // Generate a default plan name based on existing portfolios
  function getDefaultPlanName(): string {
    const existingCount = appStore.portfolios.length
    return `Plan ${existingCount + 1}`
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
  let currency = $state(appStore.profile.currency ?? DEFAULT_CURRENCY)
  let inflation = $state<number | undefined>(2)
  let hydrated = $state(false)

  // Re-hydrate the form from a previously saved draft exactly once, on first
  // load, so navigating back to this step preserves the user's entries.
  $effect(() => {
    if (hydrated) return
    const details = loadPlanDraft().details
    if (details) {
      name = details.name
      notes = details.notes
      startType = details.startType
      startYear = details.startYear
      startMonth = details.startMonth
      endType = details.endType
      endAge = details.endAge
      endYear = details.endYear
      endMonth = details.endMonth
      currency = details.currency
      inflation = details.inflation
    }
    hydrated = true
  })

  // Persist the form to the draft whenever it changes (preserving the Data
  // step's selections), so nothing is lost on back navigation.
  $effect(() => {
    if (!hydrated) return
    const details = {
      name,
      notes,
      startType,
      startYear,
      startMonth,
      endType,
      endAge,
      endYear,
      endMonth,
      currency,
      inflation,
    }
    savePlanDraft({ ...loadPlanDraft(), details })
  })

  const years = getYearOptions()
  const months = $derived(getMonthOptions($locale ?? undefined))

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
        <Label>{$_('page.addPlan.details.start')}</Label>
        <Select.Root type="single" bind:value={startType}>
          <Select.Trigger class="w-full">
            {startType === 'now'
              ? $_('page.addPlan.details.startNow')
              : $_('page.addPlan.details.startAtDate')}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="now" label={$_('page.addPlan.details.startNow')} />
            <Select.Item value="at_specific_date" label={$_('page.addPlan.details.startAtDate')} />
          </Select.Content>
        </Select.Root>
      </div>
      {#if startType === 'at_specific_date'}
        <div class="flex flex-1 items-end gap-2">
          <Select.Root type="single" bind:value={startYear}>
            <Select.Trigger class="w-24">
              {startYear}
            </Select.Trigger>
            <Select.Content>
              {#each years as year (year)}
                <Select.Item value={year} label={year} />
              {/each}
            </Select.Content>
          </Select.Root>
          <Select.Root type="single" bind:value={startMonth}>
            <Select.Trigger class="flex-1">
              {months[Number(startMonth)]?.label ?? ''}
            </Select.Trigger>
            <Select.Content>
              {#each months as month (month.value)}
                <Select.Item value={month.value} label={month.label} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}
    </div>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.addPlan.details.end')}</Label>
        <Select.Root type="single" bind:value={endType}>
          <Select.Trigger class="w-full">
            {endType === 'when_age_is'
              ? $_('page.addPlan.details.endWhenAgeIs')
              : $_('page.addPlan.details.endAtDate')}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="when_age_is" label={$_('page.addPlan.details.endWhenAgeIs')} />
            <Select.Item value="at_specific_date" label={$_('page.addPlan.details.endAtDate')} />
          </Select.Content>
        </Select.Root>
      </div>
      {#if endType === 'when_age_is'}
        <div class="flex flex-1">
          <SuffixedInput
            value={endAge}
            suffix={$_('page.addPlan.details.yearsOld')}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (endAge = v)}
          />
        </div>
      {:else}
        <div class="flex flex-1 items-end gap-2">
          <Select.Root type="single" bind:value={endYear}>
            <Select.Trigger class="w-24">
              {#if endYear}
                {endYear}
              {:else}
                <span class="text-muted-foreground">{$_('page.setup.aboutYou.selectYear')}</span>
              {/if}
            </Select.Trigger>
            <Select.Content>
              {#each years as year (year)}
                <Select.Item value={year} label={year} />
              {/each}
            </Select.Content>
          </Select.Root>
          <Select.Root type="single" bind:value={endMonth}>
            <Select.Trigger class="flex-1">
              {#if endMonth !== ''}
                {months[Number(endMonth)]?.label ?? ''}
              {:else}
                <span class="text-muted-foreground">{$_('page.setup.aboutYou.selectMonth')}</span>
              {/if}
            </Select.Trigger>
            <Select.Content>
              {#each months as month (month.value)}
                <Select.Item value={month.value} label={month.label} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}
    </div>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.addPlan.details.currency')}</Label>
        <Select.Root type="single" bind:value={currency}>
          <Select.Trigger class="w-full">
            {CURRENCY_OPTIONS.find((c) => c.value === currency)?.label ?? currency}
          </Select.Trigger>
          <Select.Content>
            {#each CURRENCY_OPTIONS as cur (cur.value)}
              <Select.Item value={cur.value} label={cur.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.addPlan.details.inflation')}</Label>
        <SuffixedInput
          value={inflation}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (inflation = v)}
        />
      </div>
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
