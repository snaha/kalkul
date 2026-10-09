<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Undo2 from '@lucide/svelte/icons/undo-2'
  import X from '@lucide/svelte/icons/x'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

  interface Props {
    plan: PortfolioStore
    onClose: () => void
  }

  const uid = $props.id()

  let { plan, onClose }: Props = $props()

  // The cash this plan opens with: its own opening balance, else the current
  // cash. Edits land on the plan; financial data is never written from here.
  const currentCash = $derived(appStore.profile.cash_amount ?? 0)
  // Seeded synchronously at mount; the parent re-mounts this form per opening.
  // svelte-ignore state_referenced_locally
  let amount = $state<number | undefined>(plan.cash_amount ?? appStore.profile.cash_amount)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  const hasOverride = $derived(plan.cash_amount !== undefined)

  function save() {
    plan.update({ cash_amount: amount ?? 0 })
    onClose()
  }

  function reset() {
    if (!window.confirm($_('page.plan.resetCashConfirm'))) return
    plan.update({ cash_amount: undefined })
    onClose()
  }
</script>

<Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
  <Dialog.Title class="flex-1 truncate text-lg font-semibold">
    {$_('page.plan.cashItem')}
  </Dialog.Title>

  {#if hasOverride}
    <Button variant="ghost" size="icon" onclick={reset} aria-label={$_('page.plan.resetCash')}>
      <Undo2 class="size-4" />
    </Button>
  {/if}

  <Button variant="ghost" size="icon" onclick={onClose} aria-label={$_('page.plan.closeDialog')}>
    <X class="size-4" />
  </Button>
</Dialog.Header>

<div class="flex flex-col gap-4 p-4">
  <div class="flex flex-col gap-2">
    <Label for="{uid}-amount">{$_('page.plan.openingCash')}</Label>
    <SuffixedInput
      id="{uid}-amount"
      value={amount}
      suffix={currencyLabel}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (amount = v)}
    />
    <p class="text-xs text-muted-foreground">
      {$_('page.plan.openingCashHint', {
        values: { amount: appStore.formatCurrencyCode(currentCash) },
      })}
    </p>
  </div>
</div>

<Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
  <Button variant="secondary" onclick={onClose}>{$_('page.plan.cancel')}</Button>
  <Button onclick={save}>{$_('page.plan.saveChanges')}</Button>
</Dialog.Footer>
