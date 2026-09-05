<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'
  import Plus from '@lucide/svelte/icons/plus'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import X from '@lucide/svelte/icons/x'

  import { resolve } from '$app/paths'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import ImportDialog from '$lib/components/import-dialog.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card } from '$lib/components/ui/card'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as RadioGroup from '$lib/components/ui/radio-group'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import downloadBackup from '$lib/download-backup'
  import { COUNTRY_CURRENCY_MAP, getCountryItems, getLanguageItems } from '$lib/profile-options'
  import routes from '$lib/routes'
  import type { HoldingPeriod, Profile, TaxRule } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { syncStore } from '$lib/stores/sync.svelte'
  import { type Theme, themeStore } from '$lib/stores/theme.svelte'
  import {
    CURRENCY_OPTIONS,
    DEFAULT_CURRENCY,
    calculateAge,
    cn,
    getBirthYearOptions,
    getMonthOptions,
    toDateOnlyString,
  } from '$lib/utils'

  const uid = $props.id()

  // --- Sidebar ---
  type SectionId =
    | 'backup'
    | 'appearance'
    | 'localisation'
    | 'taxRules'
    | 'yourDetails'
    | 'mcpServer'
  const sections: SectionId[] = [
    'backup',
    'appearance',
    'localisation',
    'taxRules',
    'yourDetails',
    'mcpServer',
  ]
  const navLabels = $derived<Record<SectionId, string>>({
    backup: $_('page.settings.nav.backup'),
    appearance: $_('page.settings.nav.appearance'),
    localisation: $_('page.settings.nav.localisation'),
    taxRules: $_('page.settings.nav.taxRules'),
    yourDetails: $_('page.settings.nav.yourDetails'),
    mcpServer: $_('page.settings.nav.mcpServer'),
  })
  let active = $state<SectionId>('backup')

  // Buttons, not `#hash` links: the hash router on PR previews would treat
  // an anchor as navigation.
  function show(id: SectionId) {
    active = id
    document.getElementById(`${uid}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  let importOpen = $state(false)

  // --- MCP server ---
  // The field is a draft; the store only changes on Connect / Disconnect.
  let syncUrlDraft = $state('ws://localhost:3001/ws')
  // Seed the draft from the stored URL; keep it after Disconnect so reconnecting is one click.
  // A writable $derived would reset the draft to '' when the store empties.
  $effect(() => {
    if (syncStore.url) syncUrlDraft = syncStore.url
  })
  const syncDirty = $derived(syncUrlDraft.trim() !== syncStore.url)
  function connectSync(e: SubmitEvent) {
    e.preventDefault()
    syncStore.setUrl(syncUrlDraft.trim())
  }

  // --- Appearance ---
  const themeItems = $derived<SelectFieldItem<Theme>[]>([
    { value: 'system', label: $_('theme.system') },
    { value: 'light', label: $_('theme.light') },
    { value: 'dark', label: $_('theme.dark') },
  ])

  // --- Localisation ---
  const countries = $derived(getCountryItems($_))
  const languageItems = $derived(getLanguageItems($_))
  let userChangedCurrency = $state(false)

  function handleLocationChange(location: string) {
    const updates: Partial<Profile> = { location }
    const mapped = COUNTRY_CURRENCY_MAP[location]
    if (!userChangedCurrency && mapped) updates.currency = mapped
    appStore.updateProfile(updates)
  }

  // --- Tax rules ---
  type TaxRuleKey = 'investment_tax_rules' | 'tangible_asset_tax_rules'
  const holdingPeriodItems = $derived<SelectFieldItem<HoldingPeriod>[]>([
    { value: 'more_than', label: $_('page.settings.taxRules.moreThan') },
    { value: 'less_than', label: $_('page.settings.taxRules.lessThan') },
  ])

  function blankRule(): TaxRule {
    return { id: crypto.randomUUID(), holding_period: 'more_than' }
  }

  // An empty list renders one unsaved seed row (as drawn in Figma). It is
  // only persisted once the user edits it, so an untouched profile stays
  // unchanged. Created once per mount so the row keeps its identity.
  const seedRule: Record<TaxRuleKey, TaxRule> = {
    investment_tax_rules: blankRule(),
    tangible_asset_tax_rules: blankRule(),
  }

  function saveRules(key: TaxRuleKey, rules: TaxRule[]) {
    const updates: Partial<Profile> = {}
    updates[key] = rules
    appStore.updateProfile(updates)
  }

  function updateRule(key: TaxRuleKey, rows: TaxRule[], id: string, patch: Partial<TaxRule>) {
    saveRules(
      key,
      rows.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    )
  }

  // --- Your details ---
  const p = appStore.profile
  let birthYear = $state(p.birthDate ? String(p.birthDate.getFullYear()) : '')
  let birthMonth = $state(p.birthDate ? String(p.birthDate.getMonth()) : '')
  const years = getBirthYearOptions().map((year) => ({ value: year, label: year }))
  const months = $derived(getMonthOptions($locale ?? undefined))
  const now = new Date()
  const age = $derived.by(() => {
    if (birthYear === '' || birthMonth === '') return undefined
    return calculateAge(
      new Date(Number(birthYear), Number(birthMonth), 1),
      now.getFullYear(),
      now.getMonth(),
    )
  })

  function saveBirthDate() {
    if (birthYear === '' || birthMonth === '') return
    appStore.updateProfile({
      birth_date: toDateOnlyString(new Date(Number(birthYear), Number(birthMonth), 1)),
    })
  }
</script>

{#snippet taxRuleBlock(title: string, key: TaxRuleKey)}
  {@const stored = appStore.profile[key] ?? []}
  {@const rows = stored.length > 0 ? stored : [seedRule[key]]}
  <div class="flex w-full flex-col gap-4">
    <h3 class="text-base font-bold text-foreground">{title}</h3>
    {#each rows as rule (rule.id)}
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-{key}-{rule.id}-rate">
            {$_('page.settings.taxRules.capitalGainsTax')}
          </Label>
          <SuffixedInput
            id="{uid}-{key}-{rule.id}-rate"
            value={rule.rate}
            suffix="%"
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => updateRule(key, rows, rule.id, { rate: v })}
          />
        </div>
        <span
          class="flex h-8 w-[10px] shrink-0 items-center justify-center text-sm font-medium text-muted-foreground"
        >
          {$_('page.settings.taxRules.if')}
        </span>
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-{key}-{rule.id}-period">
            {$_('page.settings.taxRules.holdingPeriodIs')}
          </Label>
          <SelectField
            id="{uid}-{key}-{rule.id}-period"
            value={rule.holding_period}
            items={holdingPeriodItems}
            onValueChange={(v) => updateRule(key, rows, rule.id, { holding_period: v })}
          />
        </div>
        <div class="flex flex-1">
          <SuffixedInput
            value={rule.holding_years}
            suffix={$_('page.settings.taxRules.years')}
            aria-label={$_('page.settings.taxRules.holdingYears')}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => updateRule(key, rows, rule.id, { holding_years: v })}
          />
        </div>
        <HelpTooltip
          text={$_('page.settings.taxRules.cgtHelp')}
          class="flex size-8 items-center justify-center rounded-md hover:bg-accent"
        />
        {#if stored.length > 0}
          <!-- Not drawn in Figma; without it an added rule could never be removed. -->
          <Button
            variant="ghost"
            size="icon"
            aria-label={$_('page.settings.taxRules.removeRule')}
            onclick={() =>
              saveRules(
                key,
                stored.filter((r) => r.id !== rule.id),
              )}
          >
            <Trash2 class="size-4" />
          </Button>
        {/if}
      </div>
    {/each}
    <div>
      <Button variant="outline" onclick={() => saveRules(key, [...rows, blankRule()])}>
        <Plus class="size-4" />
        {$_('page.settings.taxRules.addRule')}
      </Button>
    </div>
  </div>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  <header class="flex items-center gap-4 p-8">
    <h1 class="flex-1 text-2xl font-bold text-foreground">{$_('page.settings.title')}</h1>
    <Button
      variant="ghost"
      size="icon"
      href={resolve(routes.HOME)}
      aria-label={$_('page.settings.close')}
    >
      <X class="size-4" />
    </Button>
  </header>

  <div class="flex min-h-0 flex-1 gap-8 px-8">
    <Card class="w-72 shrink-0 self-start gap-0 p-2">
      <nav class="flex flex-col">
        {#each sections as id (id)}
          <button
            type="button"
            onclick={() => show(id)}
            class={cn(
              'flex h-8 items-center gap-2 rounded-md p-2 text-left text-sm leading-none transition-colors hover:bg-accent',
              active === id && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
            )}
          >
            {navLabels[id]}
          </button>
        {/each}
      </nav>
    </Card>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-8 overflow-y-auto pb-8">
      <!-- Backup -->
      <section id="{uid}-backup" class="flex w-full max-w-[576px] scroll-mt-8 flex-col gap-4">
        <h2 class="text-xl font-bold text-foreground">{navLabels.backup}</h2>
        <div class="flex items-start gap-4">
          <Button variant="outline" class="w-44" onclick={downloadBackup}>
            <FileDown class="size-4" />
            {$_('page.settings.backup.export')}
          </Button>
          <p class="flex-1 text-sm font-medium text-muted-foreground">
            {$_('page.settings.backup.exportDescription')}
          </p>
        </div>
        <div class="flex items-start gap-4">
          <Button variant="outline" class="w-44" onclick={() => (importOpen = true)}>
            <RefreshCw class="size-4" />
            {$_('page.settings.backup.import')}
          </Button>
          <p class="flex-1 text-sm font-medium text-muted-foreground">
            {$_('page.settings.backup.importDescription')}
          </p>
        </div>
      </section>

      <Separator class="max-w-[576px]" />

      <!-- Appearance -->
      <section id="{uid}-appearance" class="flex w-full max-w-[576px] scroll-mt-8 flex-col gap-4">
        <h2 class="text-xl font-bold text-foreground">{navLabels.appearance}</h2>
        <RadioGroup.Root
          value={themeStore.theme}
          onValueChange={(v) => themeStore.set(v as Theme)}
          aria-label={navLabels.appearance}
        >
          {#each themeItems as item (item.value)}
            <div class="flex items-center gap-2">
              <RadioGroup.Item value={item.value} id="{uid}-theme-{item.value}" />
              <Label for="{uid}-theme-{item.value}">{item.label}</Label>
            </div>
          {/each}
        </RadioGroup.Root>
      </section>

      <Separator class="max-w-[576px]" />

      <!-- Localisation -->
      <section id="{uid}-localisation" class="flex w-full max-w-[576px] scroll-mt-8 flex-col gap-4">
        <h2 class="text-xl font-bold text-foreground">{navLabels.localisation}</h2>
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label for="{uid}-location">{$_('page.setup.aboutYou.location')}</Label>
            <SelectField
              id="{uid}-location"
              value={appStore.profile.location ?? ''}
              items={countries}
              placeholder={$_('page.setup.aboutYou.selectCountry')}
              onValueChange={handleLocationChange}
            />
          </div>
          <div class="flex w-24 flex-col gap-2">
            <Label for="{uid}-currency">{$_('common.currency')}</Label>
            <SelectField
              id="{uid}-currency"
              value={appStore.profile.currency ?? ''}
              items={CURRENCY_OPTIONS}
              placeholder={DEFAULT_CURRENCY}
              onValueChange={(currency) => {
                userChangedCurrency = true
                appStore.updateProfile({ currency })
              }}
            />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="{uid}-language">{$_('page.setup.aboutYou.language')}</Label>
          <SelectField
            id="{uid}-language"
            value={appStore.profile.language ?? 'en'}
            items={languageItems}
            onValueChange={(language) => appStore.updateProfile({ language })}
          />
        </div>
      </section>

      <Separator class="max-w-[576px]" />

      <!-- Tax rules -->
      <section id="{uid}-taxRules" class="flex w-full max-w-[576px] scroll-mt-8 flex-col gap-8">
        <div class="flex flex-col">
          <h2 class="text-xl font-bold text-foreground">{navLabels.taxRules}</h2>
          <p class="text-sm text-muted-foreground">{$_('page.settings.taxRules.description')}</p>
        </div>
        {@render taxRuleBlock($_('page.settings.taxRules.investments'), 'investment_tax_rules')}
        {@render taxRuleBlock(
          $_('page.settings.taxRules.tangibleAssets'),
          'tangible_asset_tax_rules',
        )}
      </section>

      <Separator class="max-w-[576px]" />

      <!-- Your details -->
      <section id="{uid}-yourDetails" class="flex w-full max-w-[576px] scroll-mt-8 flex-col gap-4">
        <h2 class="text-xl font-bold text-foreground">{navLabels.yourDetails}</h2>
        <div class="flex flex-col gap-2">
          <Label for="{uid}-name">{$_('page.setup.aboutYou.name')}</Label>
          <Input
            id="{uid}-name"
            value={appStore.profile.name}
            placeholder={$_('page.setup.aboutYou.namePlaceholder')}
            oninput={(e) => appStore.updateProfile({ name: e.currentTarget.value })}
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="{uid}-birth-year">{$_('page.setup.aboutYou.birthdate')}</Label>
          <div class="flex items-center gap-2">
            <SelectField
              id="{uid}-birth-year"
              bind:value={birthYear}
              items={years}
              placeholder={$_('page.setup.aboutYou.selectYear')}
              class="w-24"
              onValueChange={saveBirthDate}
            />
            <SelectField
              bind:value={birthMonth}
              items={months}
              placeholder={$_('page.setup.aboutYou.selectMonth')}
              aria-label={$_('page.setup.aboutYou.selectMonth')}
              class="flex-1"
              onValueChange={saveBirthDate}
            />
            <p class="flex-1 text-sm text-muted-foreground">
              {#if age !== undefined}
                {$_('page.setup.aboutYou.age', { values: { age } })}
              {:else}
                {$_('page.setup.aboutYou.ageHelper')}
              {/if}
            </p>
          </div>
        </div>
      </section>

      <Separator class="max-w-[576px]" />

      <!-- MCP server -->
      <section id="{uid}-mcpServer" class="flex w-full max-w-[576px] scroll-mt-8 flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-bold text-foreground">{navLabels.mcpServer}</h2>
          <p class="text-sm text-muted-foreground">{$_('page.settings.mcpServer.description')}</p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="{uid}-sync-url">{$_('page.settings.mcpServer.url')}</Label>
          <form class="flex gap-2" onsubmit={connectSync}>
            <Input id="{uid}-sync-url" bind:value={syncUrlDraft} />
            {#if syncDirty || !syncStore.url || syncStore.status === 'replaced'}
              <Button type="submit" disabled={!syncUrlDraft.trim()}>
                {$_('page.settings.mcpServer.connect')}
              </Button>
            {:else}
              <Button type="button" variant="outline" onclick={() => syncStore.setUrl('')}>
                {$_('page.settings.mcpServer.disconnect')}
              </Button>
            {/if}
          </form>
          <p class="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              class={cn(
                'size-2 rounded-full',
                !syncStore.url
                  ? 'bg-muted-foreground/40'
                  : syncStore.status === 'connected'
                    ? 'bg-green-500'
                    : syncStore.status === 'replaced'
                      ? 'bg-amber-500'
                      : 'bg-red-500',
              )}
            ></span>
            {!syncStore.url
              ? $_('page.settings.mcpServer.off')
              : syncStore.status === 'connected'
                ? $_('page.settings.mcpServer.connected')
                : syncStore.status === 'replaced'
                  ? $_('page.settings.mcpServer.replaced')
                  : $_('page.settings.mcpServer.disconnected')}
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <Switch
              id="{uid}-web-mcp"
              checked={syncStore.webMcp}
              disabled={!syncStore.webMcpSupported}
              onCheckedChange={(on) => syncStore.setWebMcp(on)}
            />
            <Label for="{uid}-web-mcp">{$_('page.settings.mcpServer.webMcp')}</Label>
          </div>
          <p class="text-sm text-muted-foreground">
            {$_('page.settings.mcpServer.webMcpDescription')}
          </p>
          <p class="text-sm text-muted-foreground">
            {!syncStore.webMcpSupported
              ? $_('page.settings.mcpServer.webMcpNotSupported')
              : syncStore.webMcp
                ? $_('page.settings.mcpServer.webMcpExposed')
                : $_('page.settings.mcpServer.off')}
          </p>
        </div>
      </section>
    </div>
  </div>
</div>

<ImportDialog bind:open={importOpen} />
