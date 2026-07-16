<script lang="ts">
  import { _ } from 'svelte-i18n'

  import KindPickerDialog, { type KindPickerOption } from './kind-picker-dialog.svelte'

  type CashFlowKind = 'transfer' | 'income' | 'expense'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onContinue: (kind: CashFlowKind) => void
  }

  let { open = $bindable(), onOpenChange, onContinue }: Props = $props()

  const options: KindPickerOption<CashFlowKind>[] = $derived([
    {
      id: 'transfer',
      label: $_('page.plan.transfer'),
      description: $_('page.plan.transferDescription'),
    },
    {
      id: 'income',
      label: $_('page.plan.income'),
      description: $_('page.plan.incomeDescription'),
    },
    {
      id: 'expense',
      label: $_('page.plan.expense'),
      description: $_('page.plan.expenseDescription'),
    },
  ])
</script>

<KindPickerDialog
  bind:open
  {onOpenChange}
  {onContinue}
  {options}
  title={$_('page.plan.addCashFlow')}
  question={$_('page.plan.addCashFlowQuestion')}
  defaultId="transfer"
/>
