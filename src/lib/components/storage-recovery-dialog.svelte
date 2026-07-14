<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'

  import { downloadTextAsFile } from '$lib/backup'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { loadErrorStore } from '$lib/stores/load-error.svelte'

  function downloadOriginal(): void {
    if (!loadErrorStore.error) return
    downloadTextAsFile(
      `kalkul-data-recovery-${new Date().toISOString().slice(0, 10)}.json`,
      loadErrorStore.error.raw,
    )
  }

  function handleOpenChange(open: boolean): void {
    if (!open) loadErrorStore.dismiss()
  }
</script>

<!-- Shown when stored data failed to parse on load. The original payload has
     already been quarantined under a recovery key (or kept in memory if even
     that write failed), so dismissing is safe — but the download is offered
     front and center before the user continues with the salvaged subset. -->
<Dialog.Root open={loadErrorStore.error !== undefined} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('storageRecovery.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('storageRecovery.description')}
      </Dialog.Description>
    </Dialog.Header>
    <p class="text-base font-bold text-foreground">
      {$_('storageRecovery.warning')}
    </p>
    <Dialog.Footer class="sm:justify-start">
      <Button onclick={downloadOriginal}>
        <FileDown class="size-4" />
        {$_('storageRecovery.download')}
      </Button>
      <Button variant="outline" onclick={() => loadErrorStore.dismiss()}>
        {$_('storageRecovery.continue')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
