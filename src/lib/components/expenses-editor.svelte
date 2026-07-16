<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _, locale } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import { Button } from '$lib/components/ui/button'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { Expense as ExpenseData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  type ExpenseUI = Omit<ExpenseData, 'amount'> & {
    amount: number | undefined
    showAdvanced: boolean
    editing: boolean
  }

  interface Props {
    onHasValueChange?: (hasValue: boolean) => void
  }

  let { onHasValueChange }: Props = $props()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  let currentAge = $derived(
    Number(calculateAge(appStore.profile.birthDate, currentYear, currentMonth)) || undefined,
  )
  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))

  const editor = createListEditor<ExpenseData, ExpenseUI>({
    load: () => appStore.profile.expenses,
    toUI: (exp) => ({
      ...exp,
      amount: exp.amount > 0 ? exp.amount : undefined,
      showAdvanced: false,
      editing: false,
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.expenses.defaultName', { values: { index } }),
      amount: undefined,
      frequency: 'monthly',
      showAdvanced: false,
      start: 'immediately',
      start_year: currentYear,
      start_month: currentMonth,
      start_age: currentAge,
      end: 'never',
      end_year: currentYear,
      end_month: currentMonth,
      end_age: currentAge,
      change_over_time: 'none',
      change_percentage: undefined,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (e) => (e.amount ?? 0) > 0,
    toStored: (e) => ({
      id: e.id,
      name: e.name,
      amount: e.amount ?? 0,
      frequency: e.frequency,
      start: e.start,
      start_year: e.start === 'at_specific_date' ? e.start_year : undefined,
      start_month: e.start === 'at_specific_date' ? e.start_month : undefined,
      start_age: e.start === 'when_age_is' ? e.start_age : undefined,
      end: e.end,
      end_year: e.end === 'at_specific_date' ? e.end_year : undefined,
      end_month: e.end === 'at_specific_date' ? e.end_month : undefined,
      end_age: e.end === 'when_age_is' ? e.end_age : undefined,
      change_over_time: e.change_over_time,
      change_percentage:
        e.change_over_time === 'increase_yearly' || e.change_over_time === 'decrease_yearly'
          ? (e.change_percentage ?? 0)
          : undefined,
    }),
    persist: (data) => appStore.updateProfile({ expenses: data }),
  })
  onDestroy(editor.flushSave)

  $effect(() => {
    onHasValueChange?.(editor.hasAnyValue)
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as expense (expense.id)}
    <div class="flex flex-col gap-1">
      <CashFlowItemCard
        item={expense}
        suffix={currencyLabel}
        sentiment="negative"
        startDescription={$_('page.setup.expenses.startDescription')}
        endDescription={$_('page.setup.expenses.endDescription')}
        changeDescription={$_('page.setup.expenses.changeDescription')}
        {years}
        {months}
        formatCurrency={appStore.formatCurrency}
        formatNumber={appStore.formatNumber}
        onToggleEditing={() => {
          expense.editing = !expense.editing
        }}
        onDuplicate={() => editor.duplicate(expense)}
        onDelete={() => editor.remove(expense)}
      />
      <EditorItemErrors messages={editor.errors[expense.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.expenses.addExpense')}
    </Button>
  </div>
</div>
