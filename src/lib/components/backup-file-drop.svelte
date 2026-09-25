<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileUp from '@lucide/svelte/icons/file-up'

  import BackupComputerNameDialog from '$lib/components/backup-computer-name-dialog.svelte'
  import ImportDialog from '$lib/components/import-dialog.svelte'
  import { carriesFiles, pickDroppedBackup } from '$lib/dropped-backup'
  import restoreBackup from '$lib/restore-backup'
  import { appStore } from '$lib/stores/app.svelte'
  import { cloudBackupStore } from '$lib/stores/cloud-backup.svelte'

  // Mounted once in the root layout: dropping an exported backup anywhere in
  // the app imports it, and dropping the backup folder connects automatic
  // backup to it — the quick start on a second computer. Drags that carry no
  // files (selected text, links) are left alone.

  /** A folder drop can connect: supported browser, nothing connected yet. */
  const folderConnectable = $derived(
    cloudBackupStore.enabled &&
      cloudBackupStore.supported &&
      (cloudBackupStore.status.kind === 'disconnected' ||
        cloudBackupStore.status.kind === 'folder-missing'),
  )
  let nameDialogOpen = $state(false)

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)

  // dragenter/dragleave fire for every child element the pointer crosses, so
  // count the nesting depth instead of toggling, or the overlay flickers.
  let dragDepth = $state(0)
  const dragging = $derived(dragDepth > 0)

  let dialogOpen = $state(false)
  let droppedFile: File | undefined = $state()

  function handleDragEnter(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer?.types)) return
    dragDepth += 1
  }

  function handleDragOver(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer?.types)) return
    // Allows the drop; without it the browser opens the file instead.
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer?.types)) return
    dragDepth = Math.max(0, dragDepth - 1)
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    if (!carriesFiles(event.dataTransfer?.types)) return
    event.preventDefault()
    dragDepth = 0
    // The file list and the folder handle are only readable during the drop
    // event itself, so take both before awaiting anything.
    const files = Array.from(event.dataTransfer?.files ?? [])
    const handle = event.dataTransfer?.items[0]?.getAsFileSystemHandle?.()
    // A folder shows up in the file list too, as a file with no extension.
    const dropped = await handle
    if (dropped?.kind === 'directory') {
      await connectFolder(dropped as FileSystemDirectoryHandle)
      return
    }
    const picked = pickDroppedBackup(files)
    switch (picked.kind) {
      case 'none':
        return
      case 'too-many':
        alert($_('navbar.import.drop.tooMany'))
        return
      case 'wrong-type':
        alert($_('navbar.import.drop.wrongType', { values: { name: picked.name } }))
        return
      case 'file':
        if (hasData) {
          // Existing data would be replaced: confirm first and offer an export.
          droppedFile = picked.file
          dialogOpen = true
        } else {
          // Nothing to overwrite, like the landing page's "Try the demo".
          void importNow(picked.file)
        }
    }
  }

  async function connectFolder(directory: FileSystemDirectoryHandle): Promise<void> {
    if (!folderConnectable) {
      alert(
        cloudBackupStore.supported
          ? $_('navbar.import.drop.folderAlreadyConnected')
          : $_('navbar.import.drop.folderUnsupported'),
      )
      return
    }
    try {
      await cloudBackupStore.beginConnectDropped(directory)
      // The folder went missing and this is it again: keep this computer's name.
      if (cloudBackupStore.connection) await cloudBackupStore.finishConnect(undefined)
      else nameDialogOpen = true
    } catch (e) {
      console.error('Could not connect the dropped folder', e)
      alert($_('page.settings.cloudBackup.error'))
    }
  }

  async function importNow(file: File): Promise<void> {
    try {
      await restoreBackup(file)
    } catch (e) {
      console.error('Failed to import backup', e)
      alert($_('navbar.import.error'))
    }
  }
</script>

<svelte:window
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
/>

{#if dragging}
  <div
    class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
  >
    <div
      class="flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card px-8 py-10 text-center shadow-lg"
    >
      <FileUp class="size-10 text-primary" />
      <p class="text-lg font-semibold text-foreground">
        {folderConnectable
          ? $_('navbar.import.drop.titleOrFolder')
          : $_('navbar.import.drop.title')}
      </p>
      <p class="text-base text-muted-foreground">
        {hasData ? $_('navbar.import.drop.replaces') : $_('navbar.import.drop.restores')}
      </p>
      {#if folderConnectable}
        <p class="text-base text-muted-foreground">{$_('navbar.import.drop.folder')}</p>
      {/if}
    </div>
  </div>
{/if}

<ImportDialog bind:open={dialogOpen} bind:droppedFile />

<BackupComputerNameDialog
  bind:open={nameDialogOpen}
  onSubmit={(computerName) => cloudBackupStore.finishConnect(computerName)}
  onCancel={cloudBackupStore.cancelConnect}
/>
