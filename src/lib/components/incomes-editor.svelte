<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _, locale } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { Income as IncomeData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  type IncomeUI = Omit<IncomeData, 'amount'> & {
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

  const editor = createListEditor<IncomeData, IncomeUI>({
    load: () => appStore.profile.incomes,
    toUI: (inc) => ({
      ...inc,
      amount: inc.amount > 0 ? inc.amount : undefined,
      showAdvanced: false,
      editing: false,
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.income.defaultName', { values: { index } }),
      amount: undefined,
      frequency: 'monthly',
      showAdvanced: false,
      withhold_taxes: false,
      tax_percentage: undefined,
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

  $effect(() => {
    onHasValueChange?.(editor.hasAnyValue)
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as income (income.id)}
    <div class="flex flex-col gap-1">
      <CashFlowItemCard
        item={income}
        suffix={currencyLabel}
        sentiment="positive"
        startDescription={$_('page.setup.income.startDescription')}
        endDescription={$_('page.setup.income.endDescription')}
        changeDescription={$_('page.setup.income.changeDescription')}
        {years}
        {months}
        formatCurrencyCode={appStore.formatCurrencyCode}
        formatNumber={appStore.formatNumber}
        amountLabel={$_('page.setup.income.netAmount')}
        onToggleEditing={() => {
          income.editing = !income.editing
        }}
        onDuplicate={() => editor.duplicate(income)}
        onDelete={() => editor.remove(income)}
      >
        {#snippet extraAdvancedContent()}
          <div class="flex items-end gap-4">
            <div class="flex flex-1 flex-col justify-center">
              <label class="flex h-8 cursor-pointer items-center gap-2">
                <Checkbox
                  checked={income.withhold_taxes}
                  onCheckedChange={(v) => {
                    income.withhold_taxes = v === true
                  }}
                />
                <span class="text-sm font-medium leading-none">
                  {$_('page.setup.income.withholdTaxes')}
                </span>
              </label>
            </div>
            {#if income.withhold_taxes}
              <div class="flex flex-1 flex-col gap-2">
                <Label for="percentageToWithhold-{income.id}"
                  >{$_('page.setup.income.percentageToWithhold')}</Label
                >
                <SuffixedInput
                  id="percentageToWithhold-{income.id}"
                  value={income.tax_percentage}
                  suffix="%"
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    income.tax_percentage = v
                  }}
                />
              </div>
            {:else}
              <div class="flex-1"></div>
            {/if}
          </div>
        {/snippet}
      </CashFlowItemCard>
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
