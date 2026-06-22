<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { leaveGuard } from '$lib/stores/leave-guard.svelte'

  function onOpenChange(open: boolean): void {
    // Closing via overlay/escape counts as staying.
    if (!open) leaveGuard.dismiss()
  }
</script>

<Dialog.Root open={leaveGuard.open} {onOpenChange}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$_('common.leaveConfirm.title')}</Dialog.Title>
      <Dialog.Description>{$_('common.leaveConfirm.description')}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => leaveGuard.dismiss()}>
        {$_('common.leaveConfirm.stay')}
      </Button>
      <Button variant="destructive" onclick={() => leaveGuard.confirm()}>
        {$_('common.leaveConfirm.leave')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
