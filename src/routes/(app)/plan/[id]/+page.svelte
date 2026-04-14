<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowLeft } from '@lucide/svelte'

  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  const planId = $derived(page.params.id)
  const plan = $derived(appStore.portfolios.find((p) => p.id === planId))
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-8 p-8">
  {#if plan}
    <div class="flex flex-col items-center gap-4 text-center">
      <h1 class="text-3xl font-bold">{plan.name}</h1>
      {#if plan.notes}
        <p class="text-muted-foreground">{plan.notes}</p>
      {/if}
      <p class="text-lg text-muted-foreground">
        {$_('page.plan.notImplemented')}
      </p>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-4 text-center">
      <h1 class="text-2xl font-bold">{$_('page.plan.notFound')}</h1>
    </div>
  {/if}
  <Button variant="secondary" href={resolve(routes.HOME)}>
    <ArrowLeft class="size-4" />
    {$_('page.plan.backToHome')}
  </Button>
</div>
