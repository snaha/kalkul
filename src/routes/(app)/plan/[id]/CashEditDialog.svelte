<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Eye, EyeOff, Trash2, X } from '@lucide/svelte'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    plan: PortfolioStore
  }

  let { open = $bindable(), onOpenChange, plan }: Props = $props()

  let amount = $state<number | undefined>(undefined)

  // Re-seed each time the dialog opens, so reopening discards prior edits.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      amount =
        appStore.profile.cash_amount && appStore.profile.cash_amount > 0
          ? appStore.profile.cash_amount
          : undefined
    }
    wasOpen = open
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  // Cash has no per-item id, so inclusion in the plan is controlled by a
  // single `include_cash` boolean (defaults to true when undefined).
  const isIncluded = $derived(plan.include_cash !== false)
  const isExisting = $derived(
    appStore.profile.cash_amount !== undefined && appStore.profile.cash_amount > 0,
  )

  function close() {
    onOpenChange(false)
  }

  function save() {
    appStore.updateProfile({ cash_amount: amount ?? 0 })
    close()
  }

  function toggleExclude() {
    plan.update({ include_cash: isIncluded ? false : true })
  }

  function remove() {
    if (!window.confirm($_('page.plan.clearCashConfirm'))) return
    appStore.updateProfile({ cash_amount: 0 })
    close()
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-md">
    <Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
      <Dialog.Title class="flex-1 truncate text-lg font-semibold">
        {$_('page.plan.cashItem')}
      </Dialog.Title>

      {#if isExisting}
        <Button
          variant="ghost"
          size="icon"
          onclick={toggleExclude}
          aria-label={isIncluded ? $_('page.plan.excludeFromPlan') : $_('page.plan.includeInPlan')}
        >
          {#if isIncluded}
            <Eye class="size-4" />
          {:else}
            <EyeOff class="size-4 text-destructive" />
          {/if}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={remove}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-4 p-4">
      <div class="flex flex-col gap-2">
        <Label>{$_('page.setup.common.amount')}</Label>
        <SuffixedInput
          value={amount}
          suffix={currencyLabel}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (amount = v)}
        />
      </div>
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button onclick={save}>{$_('page.plan.saveChanges')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
