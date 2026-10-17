<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

  import CashEditForm from './cash-edit-form.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    plan: PortfolioStore
  }

  let { open = $bindable(), onOpenChange, plan }: Props = $props()

  function close() {
    onOpenChange(false)
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-md">
    {#if open}
      <!-- `{#if open}` re-mounts the form per opening, so it seeds from the
           current balances without `$effect` ordering games. -->
      <CashEditForm {plan} onClose={close} />
    {/if}
  </Dialog.Content>
</Dialog.Root>
