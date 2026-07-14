<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  import { downloadBackup } from '$lib/backup'
  import * as Alert from '$lib/components/ui/alert'
  import { Button } from '$lib/components/ui/button'
  import { storageErrorStore } from '$lib/stores/storage-error.svelte'
</script>

<!-- Persistent, non-dismissable: while saving fails, every edit lives only in
     this tab's memory, so the user must keep seeing the warning until a write
     succeeds (persist() clears the store on success). -->
{#if storageErrorStore.hasError}
  <div class="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
    <Alert.Root variant="destructive" class="max-w-xl border-destructive shadow-lg">
      <TriangleAlert class="size-4" />
      {#if storageErrorStore.kind === 'validation'}
        <Alert.Title>{$_('storageError.validation.title')}</Alert.Title>
      {:else}
        <Alert.Title>{$_('storageError.write.title')}</Alert.Title>
      {/if}
      <Alert.Description>
        {#if storageErrorStore.kind === 'validation'}
          {$_('storageError.validation.description')}
        {:else}
          {$_('storageError.write.description')}
        {/if}
        <Button variant="outline" size="sm" class="mt-2 text-foreground" onclick={downloadBackup}>
          <FileDown class="size-4" />
          {$_('storageError.export')}
        </Button>
      </Alert.Description>
    </Alert.Root>
  </div>
{/if}
