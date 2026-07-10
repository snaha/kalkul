<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _, locale } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
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

  function storedToUI(stored: IncomeData[]): IncomeUI[] {
    return stored.map((inc) => ({
      ...inc,
      amount: inc.amount > 0 ? inc.amount : undefined,
      showAdvanced: false,
      editing: false,
    }))
  }

  // The store is loaded before render (see +layout.ts), so the profile is
  // already populated here — seed the form state directly.
  const initial = storedToUI(appStore.profile.incomes ?? [])
  let incomes = $state<IncomeUI[]>(initial)
  let incomeCounter = $state(initial.length)

  $effect(() => {
    onHasValueChange?.(incomes.some((i) => (i.amount ?? 0) > 0))
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function addIncome() {
    incomeCounter++
    for (const inc of incomes) inc.editing = false
    incomes.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.income.defaultName', { values: { index: incomeCounter } }),
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
      editing: true,
    })
  }

  function duplicateIncome(income: IncomeUI) {
    incomeCounter++
    const idx = incomes.indexOf(income)
    incomes.splice(idx + 1, 0, {
      ...income,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: income.name } }),
      editing: true,
    })
  }

  function deleteIncome(income: IncomeUI) {
    const idx = incomes.indexOf(income)
    if (idx !== -1) incomes.splice(idx, 1)
  }

  function save() {
    const data: IncomeData[] = incomes
      .filter((i) => i.name.trim().length > 0 || (i.amount ?? 0) > 0)
      .map((i) => ({
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
      }))
    appStore.updateProfile({ incomes: data })
  }
  // Auto-save on any edit, debounced so rapid typing does one schema-parse +
  // localStorage write instead of one per keystroke. save() can throw on
  // transient invalid mid-edit data (e.g. "when age is" before an age is set),
  // so it's guarded. Skip the first (mount) run so merely viewing the page
  // doesn't rewrite the profile (and bump "last updated") without a real change.
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  function flushSave() {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    try {
      save()
    } catch {
      /* transient invalid mid-edit */
    }
  }
  let autoSaveArmed = false
  $effect(() => {
    $state.snapshot(incomes) // track every field so edits re-run this effect
    if (!autoSaveArmed) {
      autoSaveArmed = true
      return
    }
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, 300)
  })
  onDestroy(flushSave)
</script>

<div class="flex w-full flex-col gap-4">
  {#each incomes as income (income.id)}
    <CashFlowItemCard
      item={income}
      suffix={currencyLabel}
      sentiment="positive"
      startDescription={$_('page.setup.income.startDescription')}
      endDescription={$_('page.setup.income.endDescription')}
      changeDescription={$_('page.setup.income.changeDescription')}
      {years}
      {months}
      formatCurrency={appStore.formatCurrency}
      formatNumber={appStore.formatNumber}
      onToggleEditing={() => {
        income.editing = !income.editing
      }}
      onDuplicate={() => duplicateIncome(income)}
      onDelete={() => deleteIncome(income)}
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
              <Label>{$_('page.setup.income.percentageToWithhold')}</Label>
              <SuffixedInput
                value={income.tax_percentage}
                suffix="%"
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
  {/each}

  <div>
    <Button variant="secondary" onclick={addIncome}>
      <Plus class="size-4" />
      {$_('page.setup.income.addIncome')}
    </Button>
  </div>
</div>
