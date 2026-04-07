<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight, Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import CashFlowItemCard from '$lib/components/cash-flow-item-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import routes from '$lib/routes'
  import type { Income as IncomeData } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  interface IncomeUI {
    id: string
    name: string
    amount: string
    frequency: string
    showAdvanced: boolean
    withholdTaxes: boolean
    taxPercentage: string
    start: string
    startYear: string
    startMonth: string
    startAge: string
    end: string
    endYear: string
    endMonth: string
    endAge: string
    changeOverTime: string
    changePercentage: string
    editing: boolean
    editingName: boolean
  }

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  let currentAge = $derived(calculateAge(appStore.profile.birthDate, currentYear, currentMonth))
  const years = getYearOptions()
  const months = getMonthOptions()

  function storedToUI(stored: IncomeData[]): IncomeUI[] {
    return stored.map((inc) => ({
      id: inc.id,
      name: inc.name,
      amount: inc.amount > 0 ? String(inc.amount) : '',
      frequency: inc.frequency,
      showAdvanced: false,
      withholdTaxes: inc.withhold_taxes,
      taxPercentage: inc.tax_percentage !== undefined ? String(inc.tax_percentage) : '',
      start: inc.start,
      startYear: inc.start_year !== undefined ? String(inc.start_year) : String(currentYear),
      startMonth: inc.start_month !== undefined ? String(inc.start_month) : String(currentMonth),
      startAge: inc.start_age !== undefined ? String(inc.start_age) : currentAge,
      end: inc.end,
      endYear: inc.end_year !== undefined ? String(inc.end_year) : String(currentYear),
      endMonth: inc.end_month !== undefined ? String(inc.end_month) : String(currentMonth),
      endAge: inc.end_age !== undefined ? String(inc.end_age) : currentAge,
      changeOverTime: inc.change_over_time,
      changePercentage: inc.change_percentage !== undefined ? String(inc.change_percentage) : '',
      editing: false,
      editingName: false,
    }))
  }

  let incomes = $state<IncomeUI[]>([])
  let incomeCounter = $state(0)
  let loaded = $state(false)

  $effect(() => {
    const stored = appStore.profile.incomes
    if (!loaded && stored && stored.length > 0) {
      incomes = storedToUI(stored)
      incomeCounter = incomes.length
      loaded = true
    }
  })

  let canContinue = $derived(
    incomes.some((i) => i.amount.trim().length > 0 && Number(i.amount) > 0),
  )

  function addIncome() {
    incomeCounter++
    for (const inc of incomes) {
      inc.editing = false
    }
    incomes.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.income.defaultName', { values: { index: incomeCounter } }),
      amount: '',
      frequency: 'monthly',
      showAdvanced: false,
      withholdTaxes: false,
      taxPercentage: '',
      start: 'immediately',
      startYear: String(currentYear),
      startMonth: String(currentMonth),
      startAge: currentAge,
      end: 'never',
      endYear: String(currentYear),
      endMonth: String(currentMonth),
      endAge: currentAge,
      changeOverTime: 'none',
      changePercentage: '',
      editing: true,
      editingName: false,
    })
  }

  function duplicateIncome(income: IncomeUI) {
    incomeCounter++
    const idx = incomes.indexOf(income)
    const copy: IncomeUI = {
      ...income,
      id: crypto.randomUUID(),
      name: `${income.name} (copy)`,
      editing: true,
      editingName: false,
    }
    incomes.splice(idx + 1, 0, copy)
  }

  function deleteIncome(income: IncomeUI) {
    const idx = incomes.indexOf(income)
    if (idx !== -1) incomes.splice(idx, 1)
  }

  let currencyLabel = $derived(appStore.profile.currency || 'EUR')

  function formatAmount(amount: string): string {
    const num = Number(amount)
    if (isNaN(num) || num === 0) return ''
    return `+${num.toLocaleString()} ${currencyLabel}`
  }

  function saveIncomes() {
    const data: IncomeData[] = incomes
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        amount: Number(i.amount) || 0,
        frequency: i.frequency,
        withhold_taxes: i.withholdTaxes,
        tax_percentage: i.taxPercentage ? Number(i.taxPercentage) : undefined,
        start: i.start,
        start_year: i.start === 'at_specific_date' ? Number(i.startYear) : undefined,
        start_month: i.start === 'at_specific_date' ? Number(i.startMonth) : undefined,
        start_age: i.start === 'when_age_is' ? Number(i.startAge) : undefined,
        end: i.end,
        end_year: i.end === 'at_specific_date' ? Number(i.endYear) : undefined,
        end_month: i.end === 'at_specific_date' ? Number(i.endMonth) : undefined,
        end_age: i.end === 'when_age_is' ? Number(i.endAge) : undefined,
        change_over_time: i.changeOverTime,
        change_percentage:
          i.changeOverTime === 'increase_yearly' || i.changeOverTime === 'decrease_yearly'
            ? Number(i.changePercentage) || 0
            : undefined,
      }))
    appStore.updateProfile({ incomes: data })
  }

  function handleContinue() {
    saveIncomes()
    goto(resolve(routes.SETUP_EXPENSES))
  }

  function handleSkip() {
    goto(resolve(routes.SETUP_EXPENSES))
  }

  function handleBack() {
    goto(resolve(routes.SETUP_FINANCES))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.income.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.income.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each incomes as income (income.id)}
      <CashFlowItemCard
        item={income}
        {currencyLabel}
        amountColor="green"
        startDescription={$_('page.setup.income.startDescription')}
        endDescription={$_('page.setup.income.endDescription')}
        matchInflationDescription={$_('page.setup.income.matchInflationDescription')}
        changeDescription={$_('page.setup.income.changeDescription')}
        {years}
        {months}
        {formatAmount}
        onToggleEditing={() => {
          income.editing = !income.editing
        }}
        onDuplicate={() => duplicateIncome(income)}
        onDelete={() => deleteIncome(income)}
        onStartEditingName={() => {
          income.editingName = true
        }}
        onStopEditingName={() => {
          income.editingName = false
        }}
      >
        {#snippet extraAdvancedContent()}
          <div class="flex items-end gap-4">
            <div class="flex flex-1 flex-col justify-center">
              <label class="flex h-8 cursor-pointer items-center gap-2">
                <Checkbox
                  checked={income.withholdTaxes}
                  onCheckedChange={(v) => {
                    income.withholdTaxes = v === true
                  }}
                />
                <span class="text-sm font-medium leading-none">
                  {$_('page.setup.income.withholdTaxes')}
                </span>
              </label>
            </div>
            {#if income.withholdTaxes}
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.income.percentageToWithhold')}</Label>
                <SuffixedInput
                  value={income.taxPercentage}
                  suffix="%"
                  oninput={(e) => {
                    income.taxPercentage = (e.currentTarget as HTMLInputElement).value
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

  <div class="flex w-full items-center gap-4">
    <Button variant="ghost" onclick={handleBack}>
      {$_('page.setup.back')}
    </Button>
    <div class="flex flex-1 items-center justify-end gap-2">
      <Button variant="ghost" onclick={handleSkip}>
        {$_('page.setup.skip')}
      </Button>
      <Button disabled={!canContinue} onclick={handleContinue}>
        {$_('page.setup.continue')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
