<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import routes from '$lib/routes'
  import { onboardingDraft as draft } from '$lib/stores/onboarding-draft.svelte'
  import {
    CURRENCY_OPTIONS,
    DEFAULT_CURRENCY,
    getBirthYearOptions,
    getMonthOptions,
  } from '$lib/utils'

  const years = getBirthYearOptions()
  const months = getMonthOptions()

  const countryCurrencyMap: Record<string, string> = {
    CZ: 'CZK',
    HU: 'HUF',
    SK: 'EUR',
    FR: 'EUR',
    other: 'EUR',
  }

  let countries = $derived([
    { value: 'CZ', label: $_('common.countries.czechRepublic') },
    { value: 'SK', label: $_('common.countries.slovakia') },
    { value: 'HU', label: $_('common.countries.hungary') },
    { value: 'FR', label: $_('common.countries.france') },
    { value: 'other', label: $_('common.countries.other') },
  ])

  $effect(() => {
    if (draft.location && !draft.userChangedCurrency) {
      const mapped = countryCurrencyMap[draft.location]
      if (mapped) {
        draft.currency = mapped
      }
    }
  })

  let canContinue = $derived(
    draft.name.trim().length > 0 && draft.birthYear !== '' && draft.birthMonth !== '',
  )

  function handleContinue() {
    draft.commitProfile()
    goto(resolve(routes.FINANCES_EDIT))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.aboutYou.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.aboutYou.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    <div class="flex w-full flex-col gap-2">
      <Label for="setup-name">{$_('page.setup.aboutYou.name')}</Label>
      <Input
        id="setup-name"
        placeholder={$_('page.setup.aboutYou.namePlaceholder')}
        bind:value={draft.name}
      />
    </div>

    <div class="flex w-full items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.aboutYou.birthdate')}</Label>
        <Select.Root type="single" bind:value={draft.birthYear}>
          <Select.Trigger class="w-full">
            {#if draft.birthYear}
              {draft.birthYear}
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
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Select.Root type="single" bind:value={draft.birthMonth}>
          <Select.Trigger class="w-full">
            {#if draft.birthMonth !== ''}
              {months[Number(draft.birthMonth)]?.label}
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
    </div>

    <div class="flex w-full items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.aboutYou.location')}</Label>
        <Select.Root type="single" bind:value={draft.location}>
          <Select.Trigger class="w-full">
            {#if draft.location}
              {countries.find((c) => c.value === draft.location)?.label}
            {:else}
              <span class="text-muted-foreground">{$_('page.setup.aboutYou.selectCountry')}</span>
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each countries as country (country.value)}
              <Select.Item value={country.value} label={country.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex w-32 flex-col gap-2">
        <Label>{$_('common.currency')}</Label>
        <Select.Root
          type="single"
          bind:value={draft.currency}
          onValueChange={() => (draft.userChangedCurrency = true)}
        >
          <Select.Trigger class="w-full">
            {#if draft.currency}
              {CURRENCY_OPTIONS.find((c) => c.value === draft.currency)?.label}
            {:else}
              <span class="text-muted-foreground">{DEFAULT_CURRENCY}</span>
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each CURRENCY_OPTIONS as cur (cur.value)}
              <Select.Item value={cur.value} label={cur.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  </div>

  <div class="flex w-full items-center">
    <div class="flex flex-1 items-center justify-end gap-2">
      <Button disabled={!canContinue} onclick={handleContinue}>
        {$_('page.setup.continue')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
