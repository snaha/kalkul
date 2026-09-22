<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { appStore } from '$lib/stores/app.svelte'

  import CashEditForm from './cash-edit-form.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

  let { open = $bindable(), onOpenChange }: Props = $props()

  function close() {
    onOpenChange(false)
  }

  // `{#if open}` re-mounts `CashEditForm` per opening, so `initial` is read
  // synchronously at mount-time — no `$effect` ordering games.
  const initial = $derived(
    appStore.profile.cash_amount && appStore.profile.cash_amount > 0
      ? appStore.profile.cash_amount
      : undefined,
  )
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-md">
    {#if open}
      <CashEditForm {initial} onClose={close} />
    {/if}
  </Dialog.Content>
</Dialog.Root>
