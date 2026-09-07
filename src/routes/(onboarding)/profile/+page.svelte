<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import ImportDialog from '$lib/components/import-dialog.svelte'
  import LicenseDialog from '$lib/components/license-dialog.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { COUNTRY_CURRENCY_MAP, getCountryItems, getLanguageItems } from '$lib/profile-options'
  import routes from '$lib/routes'
  import type { Profile } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import {
    CURRENCY_OPTIONS,
    DEFAULT_CURRENCY,
    calculateAge,
    getBirthYearOptions,
    getMonthOptions,
    toDateOnlyString,
  } from '$lib/utils'

  // The store is loaded before render (see +layout.ts), so the profile is
  // already populated here — seed the form state directly.
  const p = appStore.profile
  let name = $state(p.name)
  let birthYear = $state(p.birthDate ? String(p.birthDate.getFullYear()) : '')
  let birthMonth = $state(p.birthDate ? String(p.birthDate.getMonth()) : '')
  let location = $state(p.location ?? '')
  let currency = $state(p.currency ?? '')
  let language = $state(p.language ?? 'en')
  // Persisted, so navigating Back to this step does not force the user to
  // accept the terms again.
  let termsAccepted = $state(p.terms_accepted === true)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()

  const years = getBirthYearOptions().map((year) => ({ value: year, label: year }))
  // Reactive and locale-aware: Intl produces these month names, so passing
  // the UI language keeps them in step with it (a bare getMonthOptions()
  // would leak the OS locale instead).
  const months = $derived(getMonthOptions($locale ?? undefined))

  const languageItems = $derived(getLanguageItems($_))
  const countries = $derived(getCountryItems($_))

  let userChangedCurrency = $state(false)

  // Map country -> currency only when the user actually changes the country
  // (see COUNTRY_CURRENCY_MAP for why this must not be an $effect).
  function handleLocationChange(value: string) {
    if (userChangedCurrency) return
    const mapped = COUNTRY_CURRENCY_MAP[value]
    if (mapped) currency = mapped
  }

  // Live age preview next to the date-of-birth fields ("42 years old").
  let age = $derived.by(() => {
    if (birthYear === '' || birthMonth === '') return undefined
    const date = new Date(Number(birthYear), Number(birthMonth), 1)
    return calculateAge(date, currentYear, currentMonth)
  })

  let canContinue = $derived(
    name.trim().length > 0 && birthYear !== '' && birthMonth !== '' && termsAccepted,
  )

  let importOpen = $state(false)
  let licenseOpen = $state(false)

  function handleContinue() {
    const updates: Partial<Profile> = {
      name: name.trim(),
      location: location || undefined,
      currency: currency || undefined,
      language,
      terms_accepted: termsAccepted,
    }
    if (birthYear !== '' && birthMonth !== '') {
      const date = new Date(Number(birthYear), Number(birthMonth), 1)
      updates.birth_date = toDateOnlyString(date)
    }
    appStore.updateProfile(updates)
    goto(resolve(routes.FINANCES_EDIT))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-xl font-bold leading-7">
      {$_('page.setup.aboutYou.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.aboutYou.descriptionPrefix')}
      <button type="button" class="cursor-pointer underline" onclick={() => (importOpen = true)}
        >{$_('page.setup.aboutYou.importFile')}</button
      >{$_('page.setup.aboutYou.descriptionSuffix')}
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

    <div class="flex w-full flex-col gap-2">
      <Label for="setup-birth-year">{$_('page.setup.aboutYou.birthdate')}</Label>
      <div class="flex items-end gap-2">
        <div class="flex w-24 flex-col gap-2">
          <SelectField
            id="setup-birth-year"
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
            aria-label={$_('page.setup.aboutYou.selectMonth')}
          />
        </div>
        <p class="mb-1.5 flex-1 text-sm text-muted-foreground">
          {#if age !== undefined}
            {$_('page.setup.aboutYou.age', { values: { age } })}
          {:else}
            {$_('page.setup.aboutYou.ageHelper')}
          {/if}
        </p>
      </div>
    </div>

    <div class="flex w-full items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="setup-location">{$_('page.setup.aboutYou.location')}</Label>
        <SelectField
          id="setup-location"
          bind:value={location}
          items={countries}
          placeholder={$_('page.setup.aboutYou.selectCountry')}
          onValueChange={handleLocationChange}
        />
      </div>
      <div class="flex w-24 flex-col gap-2">
        <Label for="setup-currency">{$_('common.currency')}</Label>
        <SelectField
          id="setup-currency"
          bind:value={currency}
          items={CURRENCY_OPTIONS}
          placeholder={DEFAULT_CURRENCY}
          onValueChange={() => (userChangedCurrency = true)}
        />
      </div>
    </div>

    <div class="flex w-full flex-col gap-2">
      <Label for="setup-language">{$_('page.setup.aboutYou.language')}</Label>
      <SelectField
        id="setup-language"
        bind:value={language}
        items={languageItems}
        onValueChange={(v) => {
          if (v) language = v
        }}
      />
    </div>

    <label class="flex items-center gap-2">
      <Checkbox
        id="setup-terms"
        checked={termsAccepted}
        onCheckedChange={(v) => {
          termsAccepted = v === true
        }}
      />
      <span class="text-sm text-foreground">
        {$_('page.setup.aboutYou.termsPrefix')}
        <button type="button" class="cursor-pointer underline" onclick={() => (licenseOpen = true)}
          >{$_('page.setup.aboutYou.termsLink')}</button
        >
      </span>
    </label>
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

<ImportDialog bind:open={importOpen} />
<LicenseDialog bind:open={licenseOpen} />
