<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'
  import FileInput from '@lucide/svelte/icons/file-input'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { appStore } from '$lib/stores/app.svelte'
  import { slugify } from '$lib/utils'

  interface Props {
    open: boolean
  }

  let { open = $bindable() }: Props = $props()

  const hasData = $derived(!appStore.loading && !!appStore.profile.name)

  let fileInput: HTMLInputElement | undefined = $state()
  let backupExported = $state(false)

  // Reset the "exported" transition state whenever the import dialog closes.
  $effect(() => {
    if (!open) backupExported = false
  })

  function exportData(): void {
    const json = appStore.exportBackup()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const nameSlug = slugify(appStore.profile.name)
    a.download = `kalkul-backup-${nameSlug ? `${nameSlug}-` : ''}${new Date().toISOString().slice(0, 10)}.kalkul.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Delay revoke so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function triggerFileSelect(): void {
    fileInput?.click()
  }

  function exportBeforeImporting(): void {
    exportData()
    // Keep the dialog open and transition to the "ready to import" state.
    // The file picker needs its own user gesture, so we don't open it here.
    backupExported = true
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      appStore.importBackup(text)
      open = false
    } catch (e) {
      console.error('Failed to import backup', e)
      alert($_('navbar.import.error'))
    } finally {
      input.value = ''
    }
  }
</script>

<!-- Hidden file input used by both Import dialog paths -->
<input
  bind:this={fileInput}
  type="file"
  accept=".kalkul.json"
  class="hidden"
  onchange={handleFileSelect}
/>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('navbar.import.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {#if hasData}
          {$_('navbar.import.descriptionShort')}
        {:else}
          {$_('navbar.import.description')}
        {/if}
      </Dialog.Description>
    </Dialog.Header>
    {#if hasData && !backupExported}
      <p class="text-base font-bold text-foreground">
        {$_('navbar.import.warning')}
      </p>
    {:else if hasData && backupExported}
      <p class="text-base text-foreground">
        {$_('navbar.import.backupDownloaded')}
      </p>
    {/if}
    <Dialog.Footer class="sm:justify-start">
      {#if hasData && !backupExported}
        <Button onclick={exportBeforeImporting}>
          <FileDown class="size-4" />
          {$_('navbar.import.exportBeforeImporting')}
        </Button>
        <Button variant="destructive" onclick={triggerFileSelect}>
          <FileInput class="size-4" />
          {$_('navbar.import.importAnyway')}
        </Button>
      {:else}
        <Button onclick={triggerFileSelect}>
          <FileInput class="size-4" />
          {$_('navbar.import.chooseFile')}
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
