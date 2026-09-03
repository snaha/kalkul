<!-- localization-exclude -->
<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import downloadBackup from '$lib/download-backup'
  import routes from '$lib/routes'
  import type { StoredData } from '$lib/schemas'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'

  import { type DevPreset, getDevPresets } from './presets'

  const colorCategories = [
    { name: 'Cash', colors: [CATEGORY_COLORS.cash] },
    { name: 'Investments', colors: CATEGORY_COLORS.investments },
    { name: 'Tangible assets', colors: CATEGORY_COLORS.tangibleAssets },
    { name: 'Liabilities', colors: CATEGORY_COLORS.liabilities },
  ]

  // Generated relative to load time so "updated today" and "three months ago"
  // stay true whenever the page is opened.
  const presets = getDevPresets(new Date())

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)

  let confirmOpen = $state(false)
  let pendingPreset = $state<DevPreset | undefined>(undefined)

  function requestLoadPreset(preset: DevPreset): void {
    pendingPreset = preset
    confirmOpen = true
  }

  function applyPreset(preset: DevPreset): void {
    if (preset.storedAsOf) {
      // Data as an older version would have left it: straight into storage with
      // its original write date, then loaded the way a returning user's browser
      // loads it. Going through importBackup would re-date the balances to now
      // and skip the seeding path this preset exists to show.
      const stored: StoredData = {
        profile: preset.data.profile,
        portfolios: preset.data.portfolios,
        lastUpdated: preset.storedAsOf.getTime(),
      }
      localStorage.setItem(storageKeys.DATA, JSON.stringify(stored))
      appStore.load()
    } else if (preset.data.profile.name === '') {
      appStore.clear()
    } else {
      appStore.importBackup(JSON.stringify(preset.data))
    }
    goto(resolve(routes.HOME))
  }

  // Export-first: back up any existing data before the destructive action.
  function confirmLoadPreset(): void {
    const preset = pendingPreset
    if (!preset) return
    if (hasData) downloadBackup()
    confirmOpen = false
    applyPreset(preset)
  }

  const profileJson = $derived(JSON.stringify(appStore.profile.toJSON(), undefined, 2))
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-8 p-8">
  <h1 class="text-3xl font-bold">Dev Tools</h1>

  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-bold">Load preset</h2>
    {#each presets as preset (preset.name)}
      <div class="flex items-center gap-4 rounded-lg border p-4">
        <div class="flex flex-1 flex-col gap-1">
          <span class="font-medium">{preset.name}</span>
          <span class="text-sm text-muted-foreground">{preset.description}</span>
        </div>
        <Button size="sm" onclick={() => requestLoadPreset(preset)}>Load</Button>
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-bold">Chart colors</h2>
    <div class="flex flex-col gap-3">
      {#each colorCategories as category (category.name)}
        <div class="flex items-center gap-3">
          <span class="w-32 text-sm font-medium">{category.name}</span>
          <div class="flex gap-2">
            {#each category.colors as color, i (i)}
              <div class="flex flex-col items-center gap-1">
                <div class="size-10 rounded-md" style="background-color: {color}"></div>
                <span class="text-[10px] text-muted-foreground">{color}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-bold">Current profile</h2>
    <pre class="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">{profileJson}</pre>
  </div>
</div>

<!-- Confirm destructive preset load (export-first, like the navbar import flow) -->
<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('dev.confirm.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('dev.confirm.description')}
      </Dialog.Description>
    </Dialog.Header>
    {#if hasData}
      <p class="text-base font-bold text-foreground">
        {$_('dev.confirm.warning')}
      </p>
    {/if}
    <Dialog.Footer class="sm:justify-start">
      <Button variant="outline" onclick={() => (confirmOpen = false)}>
        {$_('dev.confirm.cancel')}
      </Button>
      <Button variant="destructive" onclick={confirmLoadPreset}>
        {#if hasData}
          <FileDown class="size-4" />
          {$_('dev.confirm.exportAndContinue')}
        {:else}
          {$_('dev.confirm.continue')}
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
