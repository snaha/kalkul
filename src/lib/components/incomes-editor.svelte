<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import { Button } from '$lib/components/ui/button'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { Income as IncomeData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  type IncomeUI = Omit<IncomeData, 'amount'> & {
    amount: number | undefined
    editing: boolean
  }

  const editor = createListEditor<IncomeData, IncomeUI>({
    load: () => appStore.profile.incomes,
    toUI: (inc) => ({
      ...inc,
      amount: inc.amount > 0 ? inc.amount : undefined,
      editing: false,
    }),
    // Financial data records the current income; Start/End/Change over time are
    // planned modelling and are set in the plan dialog. The required timing
    // fields are seeded so a new income is schema-valid, but no card renders
    // them; whatever a plan sets round-trips untouched through toUI/toStored.
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.income.defaultName', { values: { index } }),
      amount: undefined,
      frequency: 'monthly',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
      change_percentage: undefined,
      // Default ON so new income keeps its real value over time without the
      // user having to flip it (mirrors the transfer/expense default).
      inflation_adjusted: true,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (i) => (i.amount ?? 0) > 0,
    // The card only edits name/amount/frequency; the plan dialog already gates
    // the timing and change fields on save, so everything else passes through.
    toStored: ({ editing: _editing, ...i }) => ({ ...i, amount: i.amount ?? 0 }),
    persist: (data) => appStore.updateProfile({ incomes: data }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as income (income.id)}
    <div class="flex flex-col gap-1">
      <CashFlowItemCard
        item={income}
        suffix={currencyLabel}
        sentiment="positive"
        formatCurrencyCode={appStore.formatCurrencyCode}
        formatNumber={appStore.formatNumber}
        amountLabel={$_('page.setup.income.netAmount')}
        onToggleEditing={() => {
          income.editing = !income.editing
        }}
        onDuplicate={() => editor.duplicate(income)}
        onDelete={() => editor.remove(income)}
      />
      <EditorItemErrors messages={editor.errors[income.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.income.addIncome')}
    </Button>
  </div>
</div>
