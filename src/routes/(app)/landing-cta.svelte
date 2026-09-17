<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import { EVENTS, track } from '$lib/analytics'
  import DemoPersonaDialog from '$lib/components/demo-persona-dialog.svelte'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'

  interface Props {
    /** Shown next to the buttons; omitted in the closing section. */
    hint?: string
  }

  let { hint }: Props = $props()

  let personaDialogOpen = $state(false)

  function tryDemo(): void {
    track(EVENTS.LANDING_TRY_DEMO)
    personaDialogOpen = true
  }
</script>

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

<DemoPersonaDialog bind:open={personaDialogOpen} />
