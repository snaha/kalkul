<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileUp from '@lucide/svelte/icons/file-up'

  import { page } from '$app/state'

  import ImportDialog from '$lib/components/import-dialog.svelte'
  import { carriesFiles, pickDroppedBackup } from '$lib/dropped-backup'
  import { pluginStore } from '$lib/plugins/plugins.svelte'
  import restoreBackup, { showRestoredBackup } from '$lib/restore-backup'
  import { appStore } from '$lib/stores/app.svelte'
  import { importDialogStore } from '$lib/stores/import-dialog.svelte'

  // Mounted once in the root layout: dropping an exported backup anywhere in
  // the app imports it. Drags that carry no files (selected text, links) are
  // left alone. It also hosts the app's single Import dialog. A dropped
  // folder goes to the first active plugin that takes folders, if any.

  const folderPlugin = $derived(pluginStore.active.find((plugin) => plugin.folderDrop))

  // dragenter/dragleave fire for every child element the pointer crosses, so
  // count the nesting depth instead of toggling, or the overlay flickers.
  let dragDepth = $state(0)
  const dragging = $derived(dragDepth > 0)

  // The count can miss a dragleave: when the element under the pointer
  // unmounts, or a drag is cancelled or dropped outside the window. dragover
  // keeps firing (at least every ~350 ms) while a drag is over the page, so
  // once it stops for longer than that the drag is gone and the overlay hides.
  const DRAG_IDLE_MS = 1000
  let dragIdleTimer: ReturnType<typeof setTimeout> | undefined

  function resetDrag(): void {
    clearTimeout(dragIdleTimer)
    dragIdleTimer = undefined
    dragDepth = 0
  }

  function keepDragAlive(): void {
    clearTimeout(dragIdleTimer)
    dragIdleTimer = setTimeout(resetDrag, DRAG_IDLE_MS)
  }

  $effect(() => () => clearTimeout(dragIdleTimer))

  // Mid-onboarding there is no saved profile yet, but the form may hold typed
  // input the import would throw away, so confirm first there too.
  const onboarding = $derived(page.route.id?.startsWith('/(onboarding)') ?? false)

  let importing = false

  function handleDragEnter(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer?.types)) return
    dragDepth += 1
    keepDragAlive()
  }

  function handleDragOver(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer?.types)) return
    // Allows the drop; without it the browser opens the file instead.
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    keepDragAlive()
  }

  function handleDragLeave(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer?.types)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) resetDrag()
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    if (!carriesFiles(event.dataTransfer?.types)) return
    event.preventDefault()
    resetDrag()
    // The file list and the folder handle are only readable during the drop
    // event itself, so take both before awaiting anything.
    const files = Array.from(event.dataTransfer?.files ?? [])
    const folderDrop = folderPlugin?.folderDrop
    if (folderDrop) {
      const handle = event.dataTransfer?.items[0]?.getAsFileSystemHandle?.()
      // A folder shows up in the file list too, as a file with no extension.
      const dropped = await handle
      if (dropped?.kind === 'directory') {
        await folderDrop.drop(dropped as FileSystemDirectoryHandle)
        return
      }
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
        if (appStore.hasData || onboarding || importDialogStore.open) {
          // Something could be lost: confirm first and offer an export. An
          // already open Import dialog takes the dropped file in place.
          importDialogStore.openWithFile(picked.file)
        } else {
          // Nothing to overwrite, like the landing page's "Try the demo".
          void importNow(picked.file)
        }
    }
  }

  async function importNow(file: File): Promise<void> {
    if (importing) return
    importing = true
    try {
      await restoreBackup(file)
    } catch (e) {
      console.error('Failed to import backup', e)
      alert($_('navbar.import.error'))
      return
    } finally {
      importing = false
    }
    await showRestoredBackup()
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
      <p class="text-lg font-semibold text-foreground">{$_('navbar.import.drop.title')}</p>
      <p class="text-base text-muted-foreground">
        {appStore.hasData ? $_('navbar.import.drop.replaces') : $_('navbar.import.drop.restores')}
      </p>
      {#if folderPlugin?.folderDrop}
        <folderPlugin.folderDrop.hint />
      {/if}
    </div>
  </div>
{/if}

<ImportDialog />
