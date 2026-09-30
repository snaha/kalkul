<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'
  import FileInput from '@lucide/svelte/icons/file-input'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import downloadBackup from '$lib/download-backup'
  import { BACKUP_FILE_EXTENSION } from '$lib/dropped-backup'
  import restoreBackup, { showRestoredBackup } from '$lib/restore-backup'
  import { appStore } from '$lib/stores/app.svelte'
  import { importDialogStore } from '$lib/stores/import-dialog.svelte'

  // Mounted once in the root layout; open it through `importDialogStore`.

  const droppedFile = $derived(importDialogStore.droppedFile)

  let fileInput: HTMLInputElement | undefined = $state()
  let backupExported = $state(false)
  // Guards against a double click running the import twice.
  let importing = $state(false)

  // Reset the "exported" transition state whenever the import dialog closes.
  $effect(() => {
    if (!importDialogStore.open) backupExported = false
  })

  function importFile(): void {
    if (droppedFile) void importBackup(droppedFile)
    else fileInput?.click()
  }

  function exportBeforeImporting(): void {
    downloadBackup()
    // Keep the dialog open and transition to the "ready to import" state.
    // The file picker needs its own user gesture, so we don't open it here.
    backupExported = true
  }

  async function importBackup(file: File): Promise<void> {
    if (importing) return
    importing = true
    try {
      await restoreBackup(file)
    } catch (e) {
      console.error('Failed to import backup', e)
      alert($_('navbar.import.error'))
      // Offer the file picker instead of retrying the same broken file.
      importDialogStore.forgetDroppedFile()
      return
    } finally {
      importing = false
    }
    importDialogStore.open = false
    await showRestoredBackup()
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      await importBackup(file)
    } finally {
      input.value = ''
    }
  }
</script>

<!-- Hidden file input used by both Import dialog paths -->
<input
  bind:this={fileInput}
  type="file"
  accept={BACKUP_FILE_EXTENSION}
  class="hidden"
  onchange={handleFileSelect}
/>

<Dialog.Root bind:open={importDialogStore.open}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.import.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {#if droppedFile}
          {$_('navbar.import.droppedDescription', { values: { name: droppedFile.name } })}
        {:else if appStore.hasData}
          {$_('navbar.import.descriptionShort')}
        {:else}
          {$_('navbar.import.description')}
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    {#if appStore.hasData && !backupExported}
      <p class="text-base font-bold text-foreground">
        {$_('navbar.import.warning')}
      </p>
    {:else if appStore.hasData && backupExported}
      <p class="text-base text-foreground">
        {#if droppedFile}
          {$_('navbar.import.droppedBackupDownloaded', { values: { name: droppedFile.name } })}
        {:else}
          {$_('navbar.import.backupDownloaded')}
        {/if}
      </p>
    {/if}
    <Dialog.Footer class="sm:justify-start">
      {#if appStore.hasData && !backupExported}
        <Button onclick={exportBeforeImporting} disabled={importing}>
          <FileDown class="size-4" />
          {$_('navbar.import.exportBeforeImporting')}
        </Button>
        <Button variant="destructive" onclick={importFile} disabled={importing}>
          <FileInput class="size-4" />
          {$_('navbar.import.importAnyway')}
        </Button>
      {:else}
        <Button onclick={importFile} disabled={importing}>
          <FileInput class="size-4" />
          {droppedFile ? $_('navbar.import.importFile') : $_('navbar.import.chooseFile')}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
