<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { backupFolderStore } from './store.svelte'
</script>

{#if backupFolderStore.connectable}
  <p class="text-base text-muted-foreground">{$_('plugins.backupFolder.drop.hint')}</p>
{/if}
