<script lang="ts">
  import { _ } from 'svelte-i18n'

  import KindPickerDialog, { type KindPickerOption } from './kind-picker-dialog.svelte'

  export type AssetKind = 'investment' | 'tangibleAsset' | 'liability'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onContinue: (kind: AssetKind) => void
  }

  let { open = $bindable(), onOpenChange, onContinue }: Props = $props()

  const options: KindPickerOption<AssetKind>[] = $derived([
    {
      id: 'investment',
      label: $_('page.plan.investment'),
      description: $_('page.setup.finances.investmentsDescription'),
    },
    {
      id: 'tangibleAsset',
      label: $_('page.plan.tangibleAsset'),
      description: $_('page.setup.finances.tangibleAssetsDescription'),
    },
    {
      id: 'liability',
      label: $_('page.plan.liability'),
      description: $_('page.setup.finances.liabilitiesDescription'),
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
  defaultId="investment"
/>
