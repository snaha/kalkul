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
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { planDraftStore as draft } from '$lib/stores/plan-draft.svelte'
  import { CURRENCY_OPTIONS, getMonthOptions, getYearOptions } from '$lib/utils'

  const years = getYearOptions()
  const months = $derived(getMonthOptions($locale ?? undefined))

  let canContinue = $derived(
    draft.name.trim().length > 0 &&
      draft.inflation !== undefined &&
      (draft.endType === 'when_age_is' || (draft.endYear !== '' && draft.endMonth !== '')),
  )

  function handleBack() {
    // URL is already resolved by getPrevAddPlanStepUrl
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevAddPlanStepUrl(routes.PLAN_ADD_DETAILS, appStore.profile))
  }

  function handleContinue() {
    // The draft lives in the shared store, so just advance the step.
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
      <Input id="plan-name" bind:value={draft.name} />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="plan-notes">{$_('page.addPlan.details.notes')}</Label>
      <Textarea
        id="plan-notes"
        placeholder={$_('page.addPlan.details.notesPlaceholder')}
        bind:value={draft.notes}
        class="min-h-16 resize-none"
      />
    </div>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.addPlan.details.start')}</Label>
        <Select.Root type="single" bind:value={draft.startType}>
          <Select.Trigger class="w-full">
            {draft.startType === 'now'
              ? $_('page.addPlan.details.startNow')
              : $_('page.addPlan.details.startAtDate')}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="now" label={$_('page.addPlan.details.startNow')} />
            <Select.Item value="at_specific_date" label={$_('page.addPlan.details.startAtDate')} />
          </Select.Content>
        </Select.Root>
      </div>
      {#if draft.startType === 'at_specific_date'}
        <div class="flex flex-1 items-end gap-2">
          <Select.Root type="single" bind:value={draft.startYear}>
            <Select.Trigger class="w-24">
              {draft.startYear}
            </Select.Trigger>
            <Select.Content>
              {#each years as year (year)}
                <Select.Item value={year} label={year} />
              {/each}
            </Select.Content>
          </Select.Root>
          <Select.Root type="single" bind:value={draft.startMonth}>
            <Select.Trigger class="flex-1">
              {months[Number(draft.startMonth)]?.label ?? ''}
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
        <Select.Root type="single" bind:value={draft.endType}>
          <Select.Trigger class="w-full">
            {draft.endType === 'when_age_is'
              ? $_('page.addPlan.details.endWhenAgeIs')
              : $_('page.addPlan.details.endAtDate')}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="when_age_is" label={$_('page.addPlan.details.endWhenAgeIs')} />
            <Select.Item value="at_specific_date" label={$_('page.addPlan.details.endAtDate')} />
          </Select.Content>
        </Select.Root>
      </div>
      {#if draft.endType === 'when_age_is'}
        <div class="flex flex-1">
          <SuffixedInput
            value={draft.endAge}
            suffix={$_('page.addPlan.details.yearsOld')}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (draft.endAge = v)}
          />
        </div>
      {:else}
        <div class="flex flex-1 items-end gap-2">
          <Select.Root type="single" bind:value={draft.endYear}>
            <Select.Trigger class="w-24">
              {#if draft.endYear}
                {draft.endYear}
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
          <Select.Root type="single" bind:value={draft.endMonth}>
            <Select.Trigger class="flex-1">
              {#if draft.endMonth !== ''}
                {months[Number(draft.endMonth)]?.label ?? ''}
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
        <Select.Root type="single" bind:value={draft.currency}>
          <Select.Trigger class="w-full">
            {CURRENCY_OPTIONS.find((c) => c.value === draft.currency)?.label ?? draft.currency}
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
          value={draft.inflation}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (draft.inflation = v)}
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
