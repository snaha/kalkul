<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  import { SAMPLE } from './landing-sample'

  interface Props {
    /** Shown next to the buttons; omitted in the closing section. */
    hint?: string
  }

  let { hint }: Props = $props()

  // No "this will replace your data" confirmation: the landing is only rendered
  // when nothing is stored, so there is nothing to overwrite. The page turns
  // into the dashboard by itself once the import lands.
  async function tryDemo(): Promise<void> {
    appStore.importBackup(JSON.stringify(SAMPLE))
    await goto(resolve(routes.HOME))
  }
</script>

<div class="flex flex-wrap items-center gap-3">
  <Button size="lg" href={resolve(routes.PROFILE)}>
    {$_('page.landing.cta.startPlanning')}
  </Button>
  <Button variant="outline" size="lg" onclick={tryDemo}>
    {$_('page.landing.cta.tryDemo')}
  </Button>
  {#if hint}
    <span class="text-sm text-muted-foreground">{hint}</span>
  {/if}
</div>
