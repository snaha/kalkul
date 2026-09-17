<script lang="ts">
  import { _ } from 'svelte-i18n'

  import LifeBuoy from '@lucide/svelte/icons/life-buoy'
  import Settings from '@lucide/svelte/icons/settings'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import DiscordIcon from '$lib/components/icons/discord-icon.svelte'
  import GithubIcon from '$lib/components/icons/github-icon.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { exitDemo } from '$lib/demo'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  const buttonClass = 'text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10'

  let feedbackOpen = $state(false)

  async function getStarted(): Promise<void> {
    exitDemo()
    await goto(resolve(routes.PROFILE))
  }
</script>

<header class="flex items-center justify-between bg-neutral-950 p-2">
  <a href={resolve(routes.HOME)}>
    <img src={logo} alt="Kalkul" class="size-9" />
  </a>
  {#if appStore.demo}
    <!-- Demo banner in place of the app controls: nothing here is saved, so
         Help and Settings would only lead to dead ends. -->
    <div class="flex items-center gap-4">
      <p class="text-sm font-medium text-neutral-50">{$_('navbar.demo.notice')}</p>
      <Button
        size="sm"
        class="bg-neutral-200 text-neutral-900 hover:bg-neutral-300"
        onclick={getStarted}
      >
        {$_('navbar.demo.getStarted')}
      </Button>
    </div>
  {:else}
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
  {/if}
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
