<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'

  import { landingNotice } from './landing-notice'
  import { backupFolderStore } from './store.svelte'

  const notice = $derived(landingNotice(backupFolderStore.status))
  const folder = $derived(backupFolderStore.connection?.folder ?? '')
</script>

{#if backupFolderStore.supported}
  {#if notice === 'drop'}
    <p class="text-sm text-muted-foreground">{$_('plugins.backupFolder.landing.hint')}</p>
  {:else if notice === 'connecting'}
    <p class="text-sm text-muted-foreground" role="status">
      {$_('plugins.backupFolder.landing.connecting', { values: { folder } })}
    </p>
  {:else if notice === 'empty'}
    <p class="text-sm text-foreground" role="status">
      {$_('plugins.backupFolder.landing.empty', { values: { folder } })}
    </p>
  {:else}
    <div class="flex flex-wrap items-center gap-3" role="status">
      <p class="text-sm text-foreground">
        {$_('plugins.backupFolder.landing.attention', { values: { folder } })}
      </p>
      <Button variant="outline" size="sm" href={resolve(routes.SETTINGS)}>
        {$_('plugins.backupFolder.landing.openSettings')}
      </Button>
    </div>
  {/if}
{/if}
