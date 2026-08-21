<script lang="ts">
  import { _ } from 'svelte-i18n'

  import GithubIcon from '$lib/components/icons/github-icon.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import externalLinks from '$lib/external-links'

  interface Props {
    open: boolean
  }

  let { open = $bindable() }: Props = $props()
</script>

<Dialog.Root bind:open>
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
