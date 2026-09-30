<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { backupFolderStore } from './store.svelte'
</script>

{#if backupFolderStore.supported}
  <p class="text-sm text-muted-foreground">{$_('plugins.backupFolder.landingHint')}</p>
{/if}
