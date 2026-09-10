<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import { Button } from '$lib/components/ui/button'
  import { createListEditor } from '$lib/list-editor.svelte'
  import { planOwnedItems, sharedItems } from '$lib/plan-owned'
  import type { Expense as ExpenseData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  type ExpenseUI = Omit<ExpenseData, 'amount'> & {
    amount: number | undefined
    editing: boolean
  }

  const editor = createListEditor<ExpenseData, ExpenseUI>({
    // Financial data holds the shared items only. Those created in a plan
    // carry its id, stay hidden here and are carried through every save.
    load: () => sharedItems(appStore.profile.expenses),
    toUI: (exp) => ({
      ...exp,
      amount: exp.amount > 0 ? exp.amount : undefined,
      editing: false,
    }),
    // Financial data records the current expense; Start/End/Change over time are
    // planned modelling and are set in the plan dialog. The required timing
    // fields are seeded so a new expense is schema-valid, but no card renders
    // them; whatever a plan sets round-trips untouched through toUI/toStored.
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.expenses.defaultName', { values: { index } }),
      amount: undefined,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
      change_percentage: undefined,
      // Default ON so new expenses keep their real value over time without the
      // user having to flip it (mirrors the income/transfer default).
      inflation_adjusted: true,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (e) => (e.amount ?? 0) > 0,
    // The card only edits name/amount/frequency; the plan dialog already gates
    // the timing and change fields on save, so everything else passes through.
    toStored: ({ editing: _editing, ...e }) => ({ ...e, amount: e.amount ?? 0 }),
    persist: (data) =>
      appStore.updateProfile({ expenses: [...data, ...planOwnedItems(appStore.profile.expenses)] }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as expense (expense.id)}
    <div class="flex flex-col gap-1">
      <CashFlowItemCard
        item={expense}
        suffix={currencyLabel}
        sentiment="negative"
        formatCurrencyCode={appStore.formatCurrencyCode}
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
