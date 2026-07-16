<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Eye from '@lucide/svelte/icons/eye'
  import EyeOff from '@lucide/svelte/icons/eye-off'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import X from '@lucide/svelte/icons/x'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

  interface Props {
    initial: number | undefined
    plan: PortfolioStore
    onClose: () => void
  }

  const uid = $props.id()

  let { initial, plan, onClose }: Props = $props()

  // Seeded synchronously from `initial` at mount. Because this component is
  // wrapped in `{#if open}` by the parent, it re-mounts each time the dialog
  // opens — so reopening always re-seeds from the current cash balance.
  // svelte-ignore state_referenced_locally
  let amount = $state<number | undefined>(initial)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  const isIncluded = $derived(plan.include_cash !== false)
  const isExisting = $derived(
    appStore.profile.cash_amount !== undefined && appStore.profile.cash_amount > 0,
  )

  function save() {
    appStore.updateProfile({ cash_amount: amount ?? 0 })
    onClose()
  }

  function toggleExclude() {
    plan.update({ include_cash: isIncluded ? false : true })
    onClose()
  }

  function remove() {
    if (!window.confirm($_('page.plan.clearCashConfirm'))) return
    appStore.updateProfile({ cash_amount: 0 })
    onClose()
  }
</script>

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
    <Button variant="ghost" size="icon" onclick={remove} aria-label={$_('page.plan.deleteItem')}>
      <Trash2 class="size-4" />
    </Button>
  {/if}

  <Button variant="ghost" size="icon" onclick={onClose} aria-label={$_('page.plan.closeDialog')}>
    <X class="size-4" />
  </Button>
</Dialog.Header>

<div class="flex flex-col gap-4 p-4">
  <div class="flex flex-col gap-2">
    <Label for="{uid}-amount">{$_('page.setup.common.amount')}</Label>
    <SuffixedInput
      id="{uid}-amount"
      value={amount}
      suffix={currencyLabel}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (amount = v)}
    />
  </div>
</div>

<Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
  <Button variant="secondary" onclick={onClose}>{$_('page.plan.cancel')}</Button>
  <Button onclick={save}>{$_('page.plan.saveChanges')}</Button>
</Dialog.Footer>
