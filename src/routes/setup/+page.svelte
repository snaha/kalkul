<script lang="ts">
  import { ArrowRight } from '@lucide/svelte'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { _ } from 'svelte-i18n'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { appStore } from '$lib/stores/app.svelte'
  import routes from '$lib/routes'

  let name = $state('')
  let birthYear = $state('')
  let birthMonth = $state('')
  let location = $state('')
  let currency = $state('')
  let initialized = $state(false)

  $effect(() => {
    const p = appStore.profile
    if (!initialized && p.name) {
      name = p.name
      initialized = true
    }
    if (p.location && !location) location = p.location
    if (p.currency && !currency) currency = p.currency
    if (p.birthDate) {
      const date = p.birthDate
      if (!birthYear) birthYear = String(date.getFullYear())
      if (!birthMonth) birthMonth = String(date.getMonth())
    }
  })

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1930 + 1 }, (_, i) => String(currentYear - i))
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2000, i).toLocaleString(undefined, { month: 'long' }),
  }))

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

  const currencies = [
    { value: 'EUR', label: 'EUR' },
    { value: 'CZK', label: 'CZK' },
    { value: 'HUF', label: 'HUF' },
    { value: 'USD', label: 'USD' },
  ]

  let userChangedCurrency = $state(false)

  $effect(() => {
    if (location && !userChangedCurrency) {
      const mapped = countryCurrencyMap[location]
      if (mapped) {
        currency = mapped
      }
    }
  })

  let canContinue = $derived(name.trim().length > 0 && birthYear !== '' && birthMonth !== '')

  function handleContinue() {
    const updates: Record<string, string | undefined> = {
      name: name.trim(),
      location: location || undefined,
      currency: currency || undefined,
    }
    if (birthYear !== '' && birthMonth !== '') {
      const date = new Date(Number(birthYear), Number(birthMonth), 1)
      updates.birth_date = date.toISOString().split('T')[0]
    }
    appStore.updateProfile(updates)
    goto(resolve(routes.SETUP_FINANCES))
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
        bind:value={name}
      />
    </div>

    <div class="flex w-full items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.aboutYou.birthdate')}</Label>
        <Select.Root type="single" bind:value={birthYear}>
          <Select.Trigger class="w-full">
            {#if birthYear}
              {birthYear}
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
        <Select.Root type="single" bind:value={birthMonth}>
          <Select.Trigger class="w-full">
            {#if birthMonth !== ''}
              {months[Number(birthMonth)]?.label}
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
        <Select.Root type="single" bind:value={location}>
          <Select.Trigger class="w-full">
            {#if location}
              {countries.find((c) => c.value === location)?.label}
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
          bind:value={currency}
          onValueChange={() => (userChangedCurrency = true)}
        >
          <Select.Trigger class="w-full">
            {#if currency}
              {currencies.find((c) => c.value === currency)?.label}
            {:else}
              <span class="text-muted-foreground">EUR</span>
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each currencies as cur (cur.value)}
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
