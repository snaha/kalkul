<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  import { defaultComputerLabel } from './folder-files'
  import { backupFolderStore } from './store.svelte'

  // Mounted once (the plugin's root component) and opened by the store, for
  // a folder chosen in settings or dropped onto the page alike.
  const open = $derived(backupFolderStore.naming)

  const uid = $props.id()

  let computerName = $state('')
  let busy = $state(false)
  let submitted = false

  $effect(() => {
    if (open) {
      submitted = false
      computerName = defaultComputerLabel(navigator.userAgent)
      return
    }
    if (!submitted) backupFolderStore.cancelConnect()
  })

  const canSubmit = $derived(computerName.trim().length > 0 && !busy)

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return
    busy = true
    try {
      // Closes this dialog once connected.
      submitted = true
      await backupFolderStore.finishConnect(computerName)
    } catch (e) {
      submitted = false
      console.error('Could not connect the backup folder', e)
      alert($_('plugins.backupFolder.settings.error'))
    } finally {
      busy = false
    }
  }
</script>

<!-- holdsData: this dialog edits no data, so downloads need not wait for it. -->
<Dialog.Root bind:open={() => open, (next) => (backupFolderStore.naming = next)} holdsData={false}>
  <Dialog.Content class="sm:max-w-[576px]">
    <Dialog.Header>
      <Dialog.Title>{$_('plugins.backupFolder.settings.nameDialog.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('plugins.backupFolder.settings.nameDialog.description')}
      </Dialog.Description>
    </Dialog.Header>
    <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
      <div class="flex flex-col gap-2">
        <Label for="{uid}-computer">{$_('plugins.backupFolder.settings.nameDialog.label')}</Label>
        <Input id="{uid}-computer" autocomplete="off" bind:value={computerName} />
        <p class="text-sm text-muted-foreground">
          {$_('plugins.backupFolder.settings.nameDialog.hint')}
        </p>
      </div>
      <Dialog.Footer class="sm:justify-start">
        <Button type="submit" disabled={!canSubmit}>
          {$_('plugins.backupFolder.settings.nameDialog.connect')}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
