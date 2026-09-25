<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { defaultComputerLabel } from '$lib/cloud-backup/folder-files'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  interface Props {
    open: boolean
    /** Resolves when the folder is connected. */
    onSubmit: (computerName: string) => Promise<void>
    /** Closed without connecting. */
    onCancel?: () => void
  }

  let { open = $bindable(), onSubmit, onCancel }: Props = $props()

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
    if (!submitted) onCancel?.()
  })

  const canSubmit = $derived(computerName.trim().length > 0 && !busy)

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return
    busy = true
    try {
      await onSubmit(computerName)
      submitted = true
      open = false
    } catch (e) {
      console.error('Could not connect the backup folder', e)
      alert($_('page.settings.cloudBackup.error'))
    } finally {
      busy = false
    }
  }
</script>

<Dialog.Root bind:open>
  <!-- data-backup-dialog: not an editor, so it does not hold downloads. -->
  <Dialog.Content class="sm:max-w-[576px]" data-backup-dialog>
    <Dialog.Header>
      <Dialog.Title>{$_('page.settings.cloudBackup.nameDialog.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('page.settings.cloudBackup.nameDialog.description')}
      </Dialog.Description>
    </Dialog.Header>
    <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
      <div class="flex flex-col gap-2">
        <Label for="{uid}-computer">{$_('page.settings.cloudBackup.nameDialog.label')}</Label>
        <Input id="{uid}-computer" autocomplete="off" bind:value={computerName} />
        <p class="text-sm text-muted-foreground">
          {$_('page.settings.cloudBackup.nameDialog.hint')}
        </p>
      </div>
      <Dialog.Footer class="sm:justify-start">
        <Button type="submit" disabled={!canSubmit}>
          {$_('page.settings.cloudBackup.nameDialog.connect')}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
