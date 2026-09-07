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
      withhold_taxes: false,
      tax_percentage: undefined,
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
    toStored: (i) => ({
      id: i.id,
      name: i.name,
      amount: i.amount ?? 0,
      frequency: i.frequency,
      withhold_taxes: i.withhold_taxes,
      tax_percentage: i.tax_percentage,
      start: i.start,
      start_year: i.start === 'at_specific_date' ? i.start_year : undefined,
      start_month: i.start === 'at_specific_date' ? i.start_month : undefined,
      start_age: i.start === 'when_age_is' ? i.start_age : undefined,
      end: i.end,
      end_year: i.end === 'at_specific_date' ? i.end_year : undefined,
      end_month: i.end === 'at_specific_date' ? i.end_month : undefined,
      end_age: i.end === 'when_age_is' ? i.end_age : undefined,
      change_over_time: i.change_over_time,
      change_percentage:
        i.change_over_time === 'increase_yearly' || i.change_over_time === 'decrease_yearly'
          ? (i.change_percentage ?? 0)
          : undefined,
      inflation_adjusted: i.inflation_adjusted ?? undefined,
    }),
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
