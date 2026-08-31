<script lang="ts">
  import { _ } from 'svelte-i18n'

  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical'

  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import DiscordIcon from '$lib/components/icons/discord-icon.svelte'
  import GithubIcon from '$lib/components/icons/github-icon.svelte'
  import ImportDialog from '$lib/components/import-dialog.svelte'
  import LicenseDialog from '$lib/components/license-dialog.svelte'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import downloadBackup from '$lib/download-backup'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)

  let importOpen = $state(false)
  let feedbackOpen = $state(false)
  let licenseOpen = $state(false)
</script>

<header class="flex items-center justify-between bg-neutral-950 p-2">
  <a href={resolve(routes.HOME)}>
    <img src={logo} alt="Kalkul" class="size-9" />
  </a>
  <div class="flex items-center gap-4">
    <ThemeSwitcher class="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10" />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            variant="ghost"
            size="icon"
            class="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
            {...props}
          >
            <EllipsisVertical class="size-4" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Group>
          {#if hasData}
            <DropdownMenu.Item onSelect={downloadBackup}>
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

<!-- Import data dialog -->
<ImportDialog bind:open={importOpen} />

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
<LicenseDialog bind:open={licenseOpen} />
