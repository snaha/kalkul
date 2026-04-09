<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { EllipsisVertical, FileInput } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import DiscordIcon from '$lib/components/icons/discord-icon.svelte'
  import GithubIcon from '$lib/components/icons/github-icon.svelte'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import routes from '$lib/routes'
  import { notImplemented } from '$lib/utils'

  const GITHUB_URL = 'https://github.com/snaha-org/kalkul-next'
  const DISCORD_URL = 'https://discord.gg/kalkul'

  let importOpen = $state(false)
  let feedbackOpen = $state(false)
  let licenseOpen = $state(false)
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
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" {...props}>
                {$_('navbar.menu.visitGithub')}
              </a>
            {/snippet}
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" {...props}>
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
<Dialog.Root bind:open={importOpen}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.import.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('navbar.import.description')}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="sm:justify-start">
      <Button onclick={notImplemented}>
        <FileInput class="size-4" />
        {$_('navbar.import.chooseFile')}
      </Button>
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
      <Button variant="outline" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
        <DiscordIcon class="size-4" />
        {$_('navbar.feedback.discussOnDiscord')}
      </Button>
      <Button variant="outline" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
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
        href="https://www.gnu.org/licenses/agpl-3.0.en.html"
        target="_blank"
        rel="noopener noreferrer"
        class="underline">{$_('navbar.license.licenseName')}</a
      >{$_('navbar.license.openSourceSuffix')}
    </p>
    <Dialog.Footer class="sm:justify-start">
      <Button variant="outline" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
        <GithubIcon class="size-4" />
        {$_('navbar.license.visitGithub')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
