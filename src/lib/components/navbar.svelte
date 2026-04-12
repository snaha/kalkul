<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { EllipsisVertical, FileDown, FileInput } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import DiscordIcon from '$lib/components/icons/discord-icon.svelte'
  import GithubIcon from '$lib/components/icons/github-icon.svelte'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)

  let importOpen = $state(false)
  let feedbackOpen = $state(false)
  let licenseOpen = $state(false)
  let fileInput: HTMLInputElement | undefined = $state()
  let backupExported = $state(false)

  // Reset the "exported" transition state whenever the import dialog closes.
  $effect(() => {
    if (!importOpen) backupExported = false
  })

  function exportData(): void {
    const json = appStore.exportBackup()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kalkul-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Delay revoke so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function triggerFileSelect(): void {
    fileInput?.click()
  }

  function exportBeforeImporting(): void {
    exportData()
    // Keep the dialog open and transition to the "ready to import" state.
    // The file picker needs its own user gesture, so we don't open it here.
    backupExported = true
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      appStore.importBackup(text)
      importOpen = false
    } catch (e) {
      console.error('Failed to import backup', e)
      alert($_('navbar.import.error'))
    } finally {
      input.value = ''
    }
  }
</script>

<header class="flex items-center justify-between bg-neutral-950 p-2">
  <a href={resolve(routes.HOME)}>
    <img src={logo} alt="Kalkul" class="size-9" />
  </a>
  <div class="flex items-center gap-4">
    <ThemeSwitcher class="text-white hover:bg-white/10" />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="ghost" size="icon" class="text-white hover:bg-white/10" {...props}>
            <EllipsisVertical class="size-4" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Group>
          {#if hasData}
            <DropdownMenu.Item onSelect={exportData}>
              {$_('navbar.menu.exportData')}
            </DropdownMenu.Item>
          {/if}
          <DropdownMenu.Item onSelect={() => (importOpen = true)}>
            {$_('navbar.menu.importData')}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => (feedbackOpen = true)}>
            {$_('navbar.menu.reportBug')}
          </DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Group>
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={externalLinks.GITHUB} target="_blank" rel="noopener noreferrer" {...props}>
                {$_('navbar.menu.visitGithub')}
              </a>
            {/snippet}
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={externalLinks.DISCORD} target="_blank" rel="noopener noreferrer" {...props}>
                {$_('navbar.menu.joinDiscord')}
              </a>
            {/snippet}
          </DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => (licenseOpen = true)}>
          {$_('navbar.menu.usageLicense')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</header>

<!-- Hidden file input used by both Import dialog paths -->
<input
  bind:this={fileInput}
  type="file"
  accept="application/json,.json"
  class="hidden"
  onchange={handleFileSelect}
/>

<!-- Import data dialog -->
<Dialog.Root bind:open={importOpen}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.import.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {#if hasData}
          {$_('navbar.import.descriptionShort')}
        {:else}
          {$_('navbar.import.description')}
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    {#if hasData && !backupExported}
      <p class="text-base font-bold text-foreground">
        {$_('navbar.import.warning')}
      </p>
    {:else if hasData && backupExported}
      <p class="text-base text-foreground">
        {$_('navbar.import.backupDownloaded')}
      </p>
    {/if}
    <Dialog.Footer class="sm:justify-start">
      {#if hasData && !backupExported}
        <Button onclick={exportBeforeImporting}>
          <FileDown class="size-4" />
          {$_('navbar.import.exportBeforeImporting')}
        </Button>
        <Button variant="destructive" onclick={triggerFileSelect}>
          <FileInput class="size-4" />
          {$_('navbar.import.importAnyway')}
        </Button>
      {:else}
        <Button onclick={triggerFileSelect}>
          <FileInput class="size-4" />
          {$_('navbar.import.chooseFile')}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Report bug and feedback dialog -->
<Dialog.Root bind:open={feedbackOpen}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.feedback.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('navbar.feedback.description')}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="sm:justify-start">
      <Button
        variant="outline"
        href={externalLinks.DISCORD}
        target="_blank"
        rel="noopener noreferrer"
      >
        <DiscordIcon class="size-4" />
        {$_('navbar.feedback.discussOnDiscord')}
      </Button>
      <Button
        variant="outline"
        href={externalLinks.GITHUB}
        target="_blank"
        rel="noopener noreferrer"
      >
        <GithubIcon class="size-4" />
        {$_('navbar.feedback.openIssueOnGithub')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Usage and license dialog -->
<Dialog.Root bind:open={licenseOpen}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.license.title')}</Dialog.Title>
    </Dialog.Header>
    <p class="text-base font-bold text-foreground">
      {$_('navbar.license.disclaimer')}
    </p>
    <p class="text-base text-foreground">
      {$_('navbar.license.openSourcePrefix')}
      <a
        href={/* eslint-disable-line svelte/no-navigation-without-resolve */ externalLinks.AGPL_LICENSE}
        target="_blank"
        rel="noopener noreferrer"
        class="underline">{$_('navbar.license.licenseName')}</a
      >{$_('navbar.license.openSourceSuffix')}
    </p>
    <Dialog.Footer class="sm:justify-start">
      <Button
        variant="outline"
        href={externalLinks.GITHUB}
        target="_blank"
        rel="noopener noreferrer"
      >
        <GithubIcon class="size-4" />
        {$_('navbar.license.visitGithub')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
