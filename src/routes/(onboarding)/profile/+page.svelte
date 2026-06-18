<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import SelectField from '$lib/components/select-field.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import {
    CURRENCY_OPTIONS,
    DEFAULT_CURRENCY,
    getBirthYearOptions,
    getMonthOptions,
  } from '$lib/utils'

  let name = $state('')
  let birthYear = $state('')
  let birthMonth = $state('')
  let location = $state('')
  let currency = $state('')
  let hydrated = $state(false)

  // Hydrate form state from the store exactly once, on first load.
  $effect(() => {
    if (hydrated || appStore.loading) return
    const p = appStore.profile
    name = p.name
    if (p.location) location = p.location
    if (p.currency) currency = p.currency
    if (p.birthDate) {
      birthYear = String(p.birthDate.getFullYear())
      birthMonth = String(p.birthDate.getMonth())
    }
    hydrated = true
  })

  const years = getBirthYearOptions().map((year) => ({ value: year, label: year }))
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
        bind:value={name}
      />
    </div>

    <div class="flex w-full items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.aboutYou.birthdate')}</Label>
        <SelectField
          bind:value={birthYear}
          items={years}
          placeholder={$_('page.setup.aboutYou.selectYear')}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <SelectField
          bind:value={birthMonth}
          items={months}
          placeholder={$_('page.setup.aboutYou.selectMonth')}
        />
      </div>
    </div>

    <div class="flex w-full items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.aboutYou.location')}</Label>
        <SelectField
          bind:value={location}
          items={countries}
          placeholder={$_('page.setup.aboutYou.selectCountry')}
        />
      </div>
      <div class="flex w-32 flex-col gap-2">
        <Label>{$_('common.currency')}</Label>
        <SelectField
          bind:value={currency}
          items={CURRENCY_OPTIONS}
          placeholder={DEFAULT_CURRENCY}
          onValueChange={() => (userChangedCurrency = true)}
        />
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
