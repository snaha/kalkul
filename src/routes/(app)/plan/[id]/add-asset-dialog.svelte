<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { appStore } from '$lib/stores/app.svelte'

  import KindPickerDialog, { type KindPickerOption } from './kind-picker-dialog.svelte'

  export type AssetKind = 'cash' | 'investment' | 'tangibleAsset' | 'liability'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onContinue: (kind: AssetKind) => void
  }

  let { open = $bindable(), onOpenChange, onContinue }: Props = $props()

  const cashAlreadyExists = $derived(
    appStore.profile.cash_amount !== undefined && appStore.profile.cash_amount > 0,
  )

  const options: KindPickerOption<AssetKind>[] = $derived([
    {
      id: 'cash',
      label: $_('page.plan.cash'),
      description: cashAlreadyExists
        ? $_('page.plan.cashAlreadyExists')
        : $_('page.plan.cashDescription'),
      // Editing cash via the add flow doesn't make sense when one already exists.
      disabled: cashAlreadyExists,
    },
    {
      id: 'investment',
      label: $_('page.plan.investment'),
      description: $_('page.plan.investmentDescription'),
    },
    {
      id: 'tangibleAsset',
      label: $_('page.plan.tangibleAsset'),
      description: $_('page.plan.tangibleAssetDescription'),
    },
    {
      id: 'liability',
      label: $_('page.plan.liability'),
      description: $_('page.plan.liabilityDescription'),
    },
  ])
</script>

<KindPickerDialog
  bind:open
  {onOpenChange}
  {onContinue}
  {options}
  title={$_('page.plan.addAsset')}
  question={$_('page.plan.addAssetQuestion')}
  defaultId={cashAlreadyExists ? 'investment' : 'cash'}
/>
