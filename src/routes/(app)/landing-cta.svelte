<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import { EVENTS, track } from '$lib/analytics'
  import DemoPersonaDialog from '$lib/components/demo-persona-dialog.svelte'
  import { Button } from '$lib/components/ui/button'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'

  import { NEWSLETTER_USERNAME } from './landing-newsletter'

  interface Props {
    /** Shown next to the buttons; omitted in the closing section. */
    hint?: string
  }

  let { hint }: Props = $props()

  let personaDialogOpen = $state(false)

  // The demo event fires when a persona is picked, in the chooser itself.
  function tryDemo(): void {
    personaDialogOpen = true
  }
</script>

{#if NEWSLETTER_USERNAME}
  <div class="flex flex-wrap items-center gap-3">
    <Button
      size="lg"
      href={externalLinks.BUTTONDOWN + NEWSLETTER_USERNAME}
      target="_blank"
      rel="noopener noreferrer"
      onclick={() => track(EVENTS.LANDING_NEWSLETTER_SUBSCRIBE)}
    >
      {$_('page.landing.newsletter.subscribe')}
    </Button>
    <span class="text-sm text-muted-foreground">{$_('page.landing.newsletter.hint')}</span>
  </div>
{:else}
  <div class="flex flex-wrap items-center gap-3">
    <Button
      size="lg"
      href={resolve(routes.PROFILE)}
      onclick={() => track(EVENTS.LANDING_START_PLANNING)}
    >
      {$_('page.landing.cta.startPlanning')}
    </Button>
    <Button variant="outline" size="lg" onclick={tryDemo}>
      {$_('page.landing.cta.tryDemo')}
    </Button>
    {#if hint}
      <span class="text-sm text-muted-foreground">{hint}</span>
    {/if}
  </div>
{/if}

<DemoPersonaDialog bind:open={personaDialogOpen} />
