<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import Trash2 from '@lucide/svelte/icons/trash-2'
  import X from '@lucide/svelte/icons/x'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Textarea } from '$lib/components/ui/textarea'
  import {
    type PlanTimelineForm,
    getPlanSpan,
    planTimelineToDates,
    seedPlanTimeline,
  } from '$lib/plan-defaults'
  import routes from '$lib/routes'
  import type { PlanEndType, PlanStartType } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  const uid = $props.id()

  const planId = $derived(page.params.id)
  const plan = $derived(appStore.portfolios.find((p) => p.id === planId))
  const planUrl = $derived(resolve(`${routes.PLAN_VIEW}/${planId ?? ''}`))

  interface FormState extends PlanTimelineForm {
    name: string
    notes: string
    inflation: number | undefined
  }

  function seedForm(): FormState {
    if (!plan) {
      return {
        name: '',
        notes: '',
        inflation: undefined,
        startType: 'now',
        startYear: '',
        startMonth: '',
        endType: 'at_specific_date',
        endAge: undefined,
        endYear: '',
        endMonth: '',
      }
    }
    return {
      name: plan.name,
      notes: plan.notes ?? '',
      inflation: plan.inflation_rate * 100,
      ...seedPlanTimeline(plan, appStore.profile),
    }
  }

  let form = $state(seedForm())

  // Re-seed once the stored plan shows up (localStorage loads asynchronously).
  let seededId: string | undefined
  $effect(() => {
    if (plan && seededId !== plan.id) {
      form = seedForm()
      seededId = plan.id
    }
  })

  const years = getYearOptions()
  const yearItems = years.map((y) => ({ value: y, label: y }))
  const months = $derived(getMonthOptions($locale ?? undefined))

  const startTypeItems: SelectFieldItem<PlanStartType>[] = $derived([
    { value: 'now', label: $_('page.planSettings.startNow') },
    { value: 'at_specific_date', label: $_('page.planSettings.startAtDate') },
  ])
  const endTypeItems: SelectFieldItem<PlanEndType>[] = $derived([
    { value: 'when_age_is', label: $_('page.planSettings.endWhenAgeIs') },
    { value: 'at_specific_date', label: $_('page.planSettings.endAtDate') },
  ])

  const dates = $derived(planTimelineToDates(form, appStore.profile))
  const span = $derived(getPlanSpan(dates.start_date, dates.end_date))

  const dirty = $derived(JSON.stringify(form) !== JSON.stringify(seedForm()))
  const canSave = $derived(
    form.name.trim().length > 0 &&
      form.inflation !== undefined &&
      (form.endType === 'when_age_is'
        ? form.endAge !== undefined
        : form.endYear !== '' && form.endMonth !== ''),
  )

  let deleteOpen = $state(false)

  function handleDone() {
    plan?.update({
      name: form.name.trim(),
      notes: form.notes.trim() || undefined,
      inflation_rate: (form.inflation ?? 0) / 100,
      ...dates,
    })
    // planUrl is already resolved
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(planUrl)
  }

  function handleDelete() {
    plan?.delete()
    deleteOpen = false
    goto(resolve(routes.HOME))
  }
</script>

<div class="flex min-h-screen flex-col bg-background">
  <header class="flex items-center gap-4 p-8">
    <h1 class="flex-1 text-2xl font-bold text-foreground">{$_('page.planSettings.title')}</h1>
    <Button variant="ghost" size="icon" href={planUrl} aria-label={$_('page.plan.closeDialog')}>
      <X class="size-4" />
    </Button>
  </header>

  <main class="flex flex-1 flex-col items-center px-8">
    {#if plan}
      <div class="flex w-full max-w-[576px] flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="{uid}-name">{$_('page.planSettings.name')}</Label>
          <Input id="{uid}-name" bind:value={form.name} />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="{uid}-inflation">
            {$_('page.planSettings.inflation', {
              values: { currency: appStore.profile.currencyOrDefault },
            })}
          </Label>
          <div class="flex items-center gap-2">
            <div class="w-36">
              <SuffixedInput
                id="{uid}-inflation"
                value={form.inflation}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => (form.inflation = v)}
              />
            </div>
            <p class="text-sm text-muted-foreground">{$_('page.planSettings.inflationHint')}</p>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label for="{uid}-start">{$_('page.planSettings.start')}</Label>
            <SelectField
              id="{uid}-start"
              value={form.startType}
              items={startTypeItems}
              onValueChange={(v) => (form.startType = v)}
            />
          </div>
          {#if form.startType === 'at_specific_date'}
            <div class="flex flex-1 items-end gap-2">
              <SelectField
                bind:value={form.startYear}
                items={yearItems}
                aria-label={$_('page.setup.aboutYou.selectYear')}
                class="w-24"
              />
              <SelectField
                bind:value={form.startMonth}
                items={months}
                aria-label={$_('page.setup.aboutYou.selectMonth')}
                class="flex-1"
              />
            </div>
          {/if}
        </div>

        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label for="{uid}-end">{$_('page.planSettings.end')}</Label>
            <SelectField
              id="{uid}-end"
              value={form.endType}
              items={endTypeItems}
              onValueChange={(v) => (form.endType = v)}
            />
          </div>
          {#if form.endType === 'when_age_is'}
            <div class="flex flex-1">
              <SuffixedInput
                value={form.endAge}
                aria-label={$_('page.planSettings.endWhenAgeIs')}
                suffix={$_('page.planSettings.yearsOld')}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => (form.endAge = v)}
              />
            </div>
          {:else}
            <div class="flex flex-1 items-end gap-2">
              <SelectField
                bind:value={form.endYear}
                items={yearItems}
                placeholder={$_('page.setup.aboutYou.selectYear')}
                aria-label={$_('page.setup.aboutYou.selectYear')}
                class="w-24"
              />
              <SelectField
                bind:value={form.endMonth}
                items={months}
                placeholder={$_('page.setup.aboutYou.selectMonth')}
                aria-label={$_('page.setup.aboutYou.selectMonth')}
                class="flex-1"
              />
            </div>
          {/if}
        </div>

        <p class="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {$_('page.planSettings.span', {
            values: { years: span.years, months: span.months },
          })}
        </p>

        <div class="flex flex-col gap-2">
          <Label for="{uid}-notes">{$_('page.planSettings.notes')}</Label>
          <Textarea id="{uid}-notes" bind:value={form.notes} class="min-h-16" />
        </div>

        <div class="flex items-center gap-2">
          <Button onclick={handleDone} disabled={!canSave}>{$_('page.planSettings.done')}</Button>
          <Button variant="ghost" onclick={() => (form = seedForm())} disabled={!dirty}>
            {$_('page.planSettings.reset')}
          </Button>
          <div class="flex flex-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              onclick={() => (deleteOpen = true)}
              aria-label={$_('page.planSettings.deleteTitle')}
              class="bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    {:else if !appStore.loading}
      <p class="text-base text-muted-foreground">{$_('page.plan.notFound')}</p>
    {/if}
  </main>
</div>

<Dialog.Root bind:open={deleteOpen}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center p-4 pb-2">
      <Dialog.Title class="flex-1 text-base font-medium">
        {$_('page.planSettings.deleteTitle')}
      </Dialog.Title>
      <Button
        variant="ghost"
        size="icon"
        onclick={() => (deleteOpen = false)}
        aria-label={$_('page.plan.closeDialog')}
      >
        <X class="size-4" />
      </Button>
    </Dialog.Header>
    <Dialog.Description class="px-4 text-base text-foreground">
      {$_('page.planSettings.deleteDescription')}
      <span class="font-bold">{$_('page.planSettings.deleteWarning')}</span>
    </Dialog.Description>
    <Dialog.Footer class="flex flex-row gap-2 p-4 sm:justify-start">
      <Button
        variant="ghost"
        onclick={handleDelete}
        class="bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
      >
        {$_('page.planSettings.deleteConfirm')}
      </Button>
      <Button variant="ghost" onclick={() => (deleteOpen = false)}>
        {$_('page.planSettings.deleteCancel')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
