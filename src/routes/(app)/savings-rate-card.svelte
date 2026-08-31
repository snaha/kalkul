<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Info from '@lucide/svelte/icons/info'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import * as Card from '$lib/components/ui/card'
  import {
    getAnnualDebtServiceTotal,
    getAnnualExpensesTotal,
    getAnnualIncomeTotal,
    getSavingsRate,
  } from '$lib/financial-totals'
  import type { Profile } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'

  interface Props {
    profile: Profile
  }

  let { profile }: Props = $props()

  type Period = 'monthly' | 'yearly'
  let period = $state<Period>('monthly')

  const periodItems: SelectFieldItem<Period>[] = $derived([
    { value: 'monthly', label: $_('page.dashboard.finances.savingsRateCard.monthly') },
    { value: 'yearly', label: $_('page.dashboard.finances.savingsRateCard.yearly') },
  ])

  const savingsRate = $derived(getSavingsRate(profile))
  const annualIncome = $derived(getAnnualIncomeTotal(profile))
  // Loan installments are an outflow just like living costs, and are counted as
  // such by the savings rate — so the expenses line has to include them too.
  const annualExpenses = $derived(
    getAnnualExpensesTotal(profile) + getAnnualDebtServiceTotal(profile),
  )

  /** Formats a per-year figure in the selected period, e.g. "800 EUR / m". */
  function perPeriod(annualAmount: number): string {
    const amount = period === 'monthly' ? annualAmount / 12 : annualAmount
    return $_('page.dashboard.finances.savingsRateCard.perPeriod', {
      values: {
        amount: appStore.formatCompactCurrency(amount),
        period: $_(`page.financialData.frequency.short.${period}`),
      },
    })
  }
</script>

<Card.Root class="gap-0 py-0 shadow-xs">
  <Card.Content class="flex flex-col gap-2 p-4">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <div class="flex flex-1 items-center gap-1">
          <p class="text-sm font-medium">{$_('page.dashboard.finances.savingsRateCard.title')}</p>
          <HelpTooltip
            text={$_('page.dashboard.finances.savingsRateCard.help')}
            icon={Info}
            iconClass="size-3"
          />
        </div>
        <SelectField
          bind:value={period}
          items={periodItems}
          aria-label={$_('page.dashboard.finances.savingsRateCard.periodLabel')}
          class="h-7 w-auto text-xs"
        />
      </div>

      <div class="flex items-center gap-2">
        {#if savingsRate}
          <p
            class={cn(
              'flex-1 text-xl font-extrabold',
              savingsRate.percent >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {appStore.formatPercent(savingsRate.percent, 0)}
          </p>
          <p class="truncate text-right text-xs font-medium">
            {perPeriod(savingsRate.annualAmount)}
          </p>
        {:else}
          <p class="flex-1 text-xl font-extrabold">—</p>
          <p class="truncate text-right text-xs text-muted-foreground">
            {$_('page.dashboard.finances.savingsRateCard.noIncomeHint')}
          </p>
        {/if}
      </div>
    </div>

    <div class="flex flex-col">
      <div class="flex items-center gap-2 text-xs">
        <span class="flex-1 truncate">
          {$_('page.dashboard.finances.savingsRateCard.totalIncome')}
        </span>
        <span class="truncate font-medium text-success">{perPeriod(annualIncome)}</span>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="flex-1 truncate">
          {$_('page.dashboard.finances.savingsRateCard.totalExpenses')}
        </span>
        <span class="truncate font-medium text-destructive">{perPeriod(-annualExpenses)}</span>
      </div>
    </div>
  </Card.Content>
</Card.Root>
