<script lang="ts">
  import { Close } from 'carbon-icons-svelte'
  import { _, locale } from 'svelte-i18n'
  import Button from '$lib/components/ui/button.svelte'
  import Input from '$lib/components/ui/input/input.svelte'
  import FormattedNumberInput from '$lib/components/ui/input/formatted-number/input.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import {
    type InvestmentStore,
    type TransactionStore,
    type InvestmentWithColorIndex,
    type Portfolio,
  } from '$lib/types'
  import { appStore } from '$lib/stores/app.svelte'
  import {
    type Period,
    type TransactionType,
    calculateTotalDisplayAmount,
    type Transaction as MathTransaction,
  } from '$lib/@snaha/kalkul-maths'
  import Select from '$lib/components/ui/select/select.svelte'
  import { capitalizeFirstLetter, formatCurrency } from '$lib/utils'
  import {
    formatDate,
    incrementDate,
    calculatePeriodDifference,
  } from '$lib/@snaha/kalkul-maths/date'
  import DateAge from './date-age.svelte'
  import Toggle from './ui/toggle.svelte'
  import { subDays } from 'date-fns'
  import FlexItem from './ui/flex-item.svelte'
  import Vertical from './ui/vertical.svelte'
  import Horizontal from './ui/horizontal.svelte'
  import { calculateNumOccurrences } from '$lib/@snaha/kalkul-maths'
  import HelperTooltip from './helper-tooltip.svelte'
  import InvestmentColorBox from './investment-color-box.svelte'
  import LoaderButton from './loader-button.svelte'

  type Props = {
    investment: InvestmentWithColorIndex & InvestmentStore
    portfolio: Portfolio
    transaction?: TransactionStore
    showInflation?: boolean
    close: () => void
  }

  let { investment, portfolio, transaction, showInflation = false, close }: Props = $props()

  let transactionType: TransactionType = $state('deposit')
  let label = $state('')
  let amount = $state<number | undefined>(undefined)
  let date = $state(new Date())
  let inflationAdjusted = $state(false)
  let isRecurring = $state(false)
  let repeat = $state(1)
  let repeatUnit: Period = $state('month')
  let endDate = $state(new Date())
  let period = $state(30)
  let periodUnit: Period = $state('year')

  const numOccurrences = $derived(
    calculateNumOccurrences({
      date: formatDate(date),
      end_date: formatDate(endDate),
      repeat_unit: repeatUnit,
      repeat,
    }),
  )
  const totalAmounts = $derived.by(() => {
    if (amount === undefined) return { nominal: 0, adjusted: 0 }

    // Create a mock transaction for calculation
    const mockTransaction: MathTransaction = {
      amount,
      type: transactionType,
      date: formatDate(date),
      inflation_adjusted: inflationAdjusted,
      end_date: isRecurring ? formatDate(endDate) : undefined,
      repeat: isRecurring ? repeat : undefined,
      repeat_unit: isRecurring ? repeatUnit : undefined,
    }

    return calculateTotalDisplayAmount(
      [mockTransaction],
      transactionType,
      portfolio.inflation_rate,
      portfolio.start_date,
    )
  })

  const totalAmount = $derived(showInflation ? totalAmounts.adjusted : totalAmounts.nominal)
  const createDisabled = $derived(
    amount === undefined ||
      amount <= 0 ||
      (isRecurring && totalAmounts.nominal === 0 && totalAmounts.adjusted === 0),
  )
  const formType = $derived(transaction ? 'edit' : 'create')

  $effect(() => {
    if (transaction) {
      transactionType = transaction.type
      label = transaction.label ?? ''
      amount = transaction.amount
      date = new Date(transaction.date)
      inflationAdjusted = transaction.inflation_adjusted ?? false
      isRecurring = transaction.end_date !== undefined
      repeat = transaction.repeat ? transaction.repeat : 1
      repeatUnit = transactionRepeatUnit(transaction)
      endDate = transaction.end_date ? new Date(transaction.end_date) : new Date()
      period = transactionPeriod(transaction)
      periodUnit = transactionPeriodUnit(transaction)
    }
  })

  function createTransaction() {
    if (amount === undefined || amount <= 0) {
      return
    }

    investment.addTransaction({
      type: transactionType,
      amount,
      label,
      date: formatDate(date),
      inflation_adjusted: inflationAdjusted,
      repeat: isRecurring ? repeat : undefined,
      repeat_unit: isRecurring ? repeatUnit : undefined,
      end_date: isRecurring ? formatDate(endDate) : undefined,
    })
    close()
  }

  function editTransaction() {
    if (!transaction || amount === undefined || amount <= 0) {
      return
    }

    transaction.update({
      type: transactionType,
      amount,
      label,
      date: formatDate(date),
      inflation_adjusted: inflationAdjusted,
      repeat: isRecurring ? repeat : undefined,
      repeat_unit: isRecurring ? repeatUnit : undefined,
      end_date: isRecurring ? formatDate(endDate) : undefined,
    })
    close()
  }

  function deleteTransaction() {
    if (!transaction) {
      return
    }

    if (confirm($_('component.editTransaction.deleteConfirmWarning'))) {
      transaction.delete()
      close()
    }
  }

  function cancel(event: Event) {
    // FIXME: not sure why this is needed here, but it won't work without it
    event.preventDefault()
    close()
  }

  function transactionRepeatUnit(t: typeof transaction): Period {
    return t && t.repeat_unit ? t.repeat_unit : 'month'
  }

  function transactionPeriod(t: typeof transaction) {
    if (!t || !t.id || !t.end_date) {
      return 30
    }

    return (
      calculatePeriodDifference(new Date(t.end_date), new Date(t.date), transactionRepeatUnit(t)) +
      1
    )
  }

  function transactionPeriodUnit(t: typeof transaction): Period {
    if (!t || !t.id || !t.end_date) {
      return 'year'
    }

    return transactionRepeatUnit(t)
  }

  function onDateChange() {
    recalculateEndDate()
  }

  function onEndDateChange() {
    recalculatePeriod()
  }

  function onPeriodChange() {
    if (!period || period <= 0) {
      return
    }
    recalculateEndDate()
  }

  function onPeriodUnitChange() {
    recalculateEndDate()
  }

  function recalculatePeriod() {
    period = calculatePeriodDifference(endDate, date, periodUnit) + 1
  }

  function recalculateEndDate() {
    endDate = subDays(incrementDate(date, periodUnit, period), 1)
  }

  function checkPeriodInput() {
    if (!period || period <= 0) {
      recalculatePeriod()
    }
  }

  function toggleRecurring() {
    recalculateEndDate()
  }
</script>

<Vertical --vertical-gap="var(--half-padding)">
  <section class="horizontal header">
    <Typography variant="h5"
      >{formType === 'create'
        ? $_('component.editTransaction.addTransaction')
        : $_('component.editTransaction.editTransaction')}</Typography
    >
    <FlexItem />
    <Button dimension="compact" variant="ghost" onclick={cancel}><Close size={24} /></Button>
  </section>
  <Vertical class="rounded">
    <div class="horizontal">
      In
      <InvestmentColorBox colorIndex={investment.colorIndex ?? 0} />
      {investment.name}
    </div>
    <div class="horizontal flex-end">
      <Select
        variant="solid"
        dimension="compact"
        bind:value={transactionType}
        label={$_('common.type')}
        items={[
          { value: 'deposit', label: capitalizeFirstLetter($_('common.deposit')) },
          { value: 'withdrawal', label: capitalizeFirstLetter($_('common.withdrawal')) },
        ]}
      ></Select>
      <Toggle
        class="toggle"
        dimension="compact"
        label={$_('common.recurring')}
        bind:checked={isRecurring}
        onchange={toggleRecurring}
      ></Toggle>
    </div>
    <FormattedNumberInput
      variant="solid"
      dimension="compact"
      placeholder={'0'}
      label={$_('common.amount')}
      unit={portfolio.currency}
      bind:value={amount}
      min={0}
      step={1}
      class="grower"
      locale={$locale}
    ></FormattedNumberInput>
    <Horizontal --horizontal-justify-content="space-between">
      <Toggle
        class="toggle"
        dimension="compact"
        label={$_('component.editTransaction.inflationAdjusted')}
        bind:checked={inflationAdjusted}
      ></Toggle>
      <HelperTooltip
        position="left"
        helperText={$_('component.viewHeader.inflationAdjustmentTooltip')}
      />
    </Horizontal>
    <Input
      dimension="compact"
      variant="solid"
      placeholder={transactionType === 'deposit'
        ? $_('common.labelPlaceholderDeposit')
        : $_('common.labelPlaceholderWithdrawal')}
      label={$_('common.label')}
      bind:value={label}
    ></Input>
    <DateAge
      dimension="compact"
      dateInputLabel={$_('common.startDate')}
      ageLabel={$_('common.age')}
      agePlaceholder={'0'}
      bind:date
      birthDate={new Date(appStore.profile.birth_date)}
      onchange={onDateChange}
    ></DateAge>
    {#if !isRecurring}
      <!-- Single transaction -->
      {#if inflationAdjusted}
        <!-- Inflation-adjusted: show both real and nominal values -->
        {#if showInflation}
          <!-- Show inflation ON: real value primary, nominal value secondary -->
          <div class="spacer"></div>
          <Vertical --vertical-gap="var(--quarter-padding)">
            <Typography class="total-amount">
              {$_('common.realValue')}: {formatCurrency(
                totalAmounts.adjusted,
                portfolio.currency,
                $locale,
              )}
            </Typography>
            <Typography class="total-amount secondary">
              {$_('common.nominalValue')}: {formatCurrency(
                totalAmounts.nominal,
                portfolio.currency,
                $locale,
              )}
            </Typography>
          </Vertical>
        {:else}
          <!-- Show inflation OFF: nominal value primary, real value secondary -->
          <div class="spacer"></div>
          <Vertical --vertical-gap="var(--quarter-padding)">
            <Typography class="total-amount">
              {$_('common.nominalValue')}: {formatCurrency(
                totalAmounts.nominal,
                portfolio.currency,
                $locale,
              )}
            </Typography>
            <Typography class="total-amount secondary">
              {$_('common.realValue')}: {formatCurrency(
                totalAmounts.adjusted,
                portfolio.currency,
                $locale,
              )}
            </Typography>
          </Vertical>
        {/if}
      {:else if showInflation}
        <!-- Not inflation-adjusted, show inflation ON: display real and nominal values -->
        <div class="spacer"></div>
        <Vertical --vertical-gap="var(--quarter-padding)">
          <Typography class="total-amount">
            {$_('common.realValue')}: {formatCurrency(
              totalAmounts.adjusted,
              portfolio.currency,
              $locale,
            )}
          </Typography>
          <Typography class="total-amount secondary">
            {$_('common.nominalValue')}: {formatCurrency(
              totalAmounts.nominal,
              portfolio.currency,
              $locale,
            )}
          </Typography>
        </Vertical>
      {/if}
      <!-- Not inflation-adjusted, show inflation OFF: display only form inputs -->
    {/if}
    {#if isRecurring}
      <section class="horizontal inputs">
        <FormattedNumberInput
          variant="solid"
          dimension="compact"
          placeholder={'1'}
          label={$_('component.editTransaction.repeatLabel')}
          min={1}
          step={1}
          bind:value={repeat}
          class="grower"
          style="max-width: 100%;"
          locale={$locale}
        ></FormattedNumberInput>
        <Select
          variant="solid"
          dimension="compact"
          bind:value={repeatUnit}
          items={[
            { value: 'day', label: $_('common.day').toLowerCase() },
            { value: 'week', label: $_('common.week').toLowerCase() },
            { value: 'month', label: $_('common.month').toLowerCase() },
            { value: 'year', label: $_('common.year').toLowerCase() },
          ]}
        ></Select>
      </section>
      <section class="horizontal inputs">
        <Input
          type="number"
          variant="solid"
          dimension="compact"
          placeholder={'30'}
          label={$_('component.editTransaction.for')}
          min={1}
          step={1}
          bind:value={period}
          style="max-width: 100%"
          class="grower"
          oninput={onPeriodChange}
          onblur={checkPeriodInput}
          onkeydown={(e) => {
            // Prevent decimal separator (. and ,) and negative sign (-)
            if (e.key === '.' || e.key === ',' || e.key === '-' || e.key === 'e' || e.key === 'E') {
              e.preventDefault()
            }
          }}
          onpaste={(e) => {
            // Clean pasted content to only allow positive integers
            e.preventDefault()
            const paste = e.clipboardData?.getData('text') || ''
            const cleanedValue = paste.replace(/[^0-9]/g, '') // Remove everything except digits
            if (cleanedValue) {
              const numValue = parseInt(cleanedValue, 10)
              if (numValue > 0) {
                period = numValue
                onPeriodChange() // Trigger the change handler
              }
            }
          }}
          inputmode="numeric"
          pattern="[0-9]*"
        ></Input>
        <Select
          variant="solid"
          dimension="compact"
          bind:value={periodUnit}
          onchange={onPeriodUnitChange}
          items={[
            { value: 'day', label: $_('common.day').toLowerCase() },
            { value: 'week', label: $_('common.week').toLowerCase() },
            { value: 'month', label: $_('common.month').toLowerCase() },
            { value: 'year', label: $_('common.year').toLowerCase() },
          ]}
        ></Select>
      </section>
      <DateAge
        dimension="compact"
        dateInputLabel={$_('common.endDate')}
        ageLabel={$_('common.age')}
        agePlaceholder={'0'}
        bind:date={endDate}
        birthDate={new Date(appStore.profile.birth_date)}
        onchange={onEndDateChange}
      ></DateAge>
      <div class="spacer"></div>
      <Vertical --vertical-gap="var(--quarter-padding)">
        <Typography>{numOccurrences} {$_('component.editTransaction.occurrences')}</Typography>
        {#if inflationAdjusted}
          <!-- Inflation-adjusted: show both total real and total nominal values -->
          {#if showInflation}
            <!-- Show inflation ON: total real primary, total nominal secondary -->
            <Typography class="total-amount">
              {$_('common.totalReal')}: {formatCurrency(
                totalAmounts.adjusted,
                portfolio.currency,
                $locale,
              )}
            </Typography>
            <Typography class="total-amount secondary">
              {$_('common.totalNominal')}: {formatCurrency(
                totalAmounts.nominal,
                portfolio.currency,
                $locale,
              )}
            </Typography>
          {:else}
            <!-- Show inflation OFF: total nominal primary, total real secondary -->
            <Typography class="total-amount">
              {$_('common.totalNominal')}: {formatCurrency(
                totalAmounts.nominal,
                portfolio.currency,
                $locale,
              )}
            </Typography>
            <Typography class="total-amount secondary">
              {$_('common.totalReal')}: {formatCurrency(
                totalAmounts.adjusted,
                portfolio.currency,
                $locale,
              )}
            </Typography>
          {/if}
        {:else if showInflation}
          <!-- Not inflation-adjusted, show inflation ON: display total real and total nominal -->
          <Typography class="total-amount">
            {$_('common.totalReal')}: {formatCurrency(
              totalAmounts.adjusted,
              portfolio.currency,
              $locale,
            )}
          </Typography>
          <Typography class="total-amount secondary">
            {$_('common.totalNominal')}: {formatCurrency(
              totalAmounts.nominal,
              portfolio.currency,
              $locale,
            )}
          </Typography>
        {:else}
          <!-- Not inflation-adjusted, show inflation OFF: display total deposited/withdrawn -->
          <Typography class="total-amount">
            {transactionType === 'deposit'
              ? $_('component.viewHeader.totalDeposited', {
                  values: { amount: formatCurrency(totalAmount, portfolio.currency, $locale) },
                })
              : $_('component.viewHeader.totalWithdrawn', {
                  values: { amount: formatCurrency(totalAmount, portfolio.currency, $locale) },
                })}
          </Typography>
        {/if}
      </Vertical>
    {/if}
    <div class="spacer"></div>
    <Vertical --vertical-align-items="stretch">
      {#if formType === 'create'}
        <LoaderButton
          variant="strong"
          dimension="compact"
          onclick={createTransaction}
          disabled={createDisabled}>{$_('common.create')}</LoaderButton
        >
      {:else}
        <LoaderButton
          variant="strong"
          dimension="compact"
          onclick={editTransaction}
          disabled={createDisabled}>{$_('common.done')}</LoaderButton
        >
      {/if}
      <Button variant="ghost" dimension="compact" onclick={cancel}>{$_('common.cancel')}</Button>
      {#if formType === 'edit'}
        <Button variant="ghost" dimension="compact" onclick={deleteTransaction} danger
          >{$_('component.editTransaction.deleteTransaction')}</Button
        >
      {/if}
    </Vertical>
  </Vertical>
</Vertical>

<style type="postcss">
  .horizontal {
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: center;
    gap: var(--half-padding);
  }
  .flex-end {
    align-items: flex-end;
    :global(.toggle) {
      border: 1px solid transparent;
    }
  }
  .horizontal :global(.grower) {
    flex: 1;
  }
  .inputs {
    align-items: flex-end;
  }
  .horizontal :global(.root) {
    max-width: calc(50% - var(--quarter-padding));
  }
  .horizontal.header {
    padding: var(--half-padding);
  }
  :global(.max-width-half) {
    max-width: calc(50% - var(--quarter-padding));
  }
  .spacer {
  }
  :global(.total-amount) {
    color: var(--colors-high);
  }
  :global(.total-amount.secondary) {
    color: var(--colors-ultra-high);
    opacity: 0.5;
  }
  :global(.rounded) {
    border-radius: var(--half-padding);
    background-color: var(--colors-ultra-low);
    padding: var(--padding);
  }
</style>
