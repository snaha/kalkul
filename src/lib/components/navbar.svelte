<script lang="ts">
  import { _ } from 'svelte-i18n'

  import LifeBuoy from '@lucide/svelte/icons/life-buoy'
  import Settings from '@lucide/svelte/icons/settings'

  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import DiscordIcon from '$lib/components/icons/discord-icon.svelte'
  import GithubIcon from '$lib/components/icons/github-icon.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'

  const buttonClass = 'text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10'

  let feedbackOpen = $state(false)
</script>

<header class="flex items-center justify-between bg-neutral-950 p-2">
  <a href={resolve(routes.HOME)}>
    <img src={logo} alt="Kalkul" class="size-9" />
  </a>
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" class={buttonClass} onclick={() => (feedbackOpen = true)}>
      <LifeBuoy class="size-4" />
      {$_('navbar.help')}
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class={buttonClass}
      href={resolve(routes.SETTINGS)}
      aria-label={$_('navbar.settings')}
    >
      <Settings class="size-4" />
    </Button>
  </div>
</header>

<!-- Help: report bug and feedback dialog -->
<Dialog.Root bind:open={feedbackOpen}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.feedback.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('navbar.feedback.description')}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="flex-wrap sm:justify-start">
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
      <Button
        variant="outline"
        href={externalLinks.AGPL_LICENSE}
        target="_blank"
        rel="noopener noreferrer"
      >
        {$_('navbar.menu.usageLicense')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
