<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right'

  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import type {
    CashFlowEnd,
    CashFlowStart,
    Frequency,
    RemainingTermUnit,
    TangibleAssetStatus,
    ValueOverTime,
  } from '$lib/schemas'
  import {
    getFrequencyItems,
    getPaymentMethodItems,
    getValueOverTimeItems,
  } from '$lib/select-options'

  /** The editable shape; the caller owns the surrounding state. */
  export interface TangibleAssetFieldsItem {
    value: number | undefined
    status: TangibleAssetStatus
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    remaining_term_unit: RemainingTermUnit
    purchase: CashFlowStart
    purchase_year: number | undefined
    purchase_month: number | undefined
    purchase_age: number | undefined
    sale: CashFlowEnd
    sale_year: number | undefined
    sale_month: number | undefined
    sale_age: number | undefined
    value_over_time: ValueOverTime
    value_rate: number | undefined
    property_tax_rate: number | undefined
  }

  interface Props {
    /** Bindable: this component writes the edited values straight back. */
    item: TangibleAssetFieldsItem
    /** Namespaces the input ids, since several of these can be on one page. */
    idPrefix: string
    /** Whether the value/tax fields are revealed. */
    showAdvanced: boolean
    /** Purchase/Sale selectors — the plan dialog plans an asset in time. */
    showTiming?: boolean
    currencyLabel: string
    years?: string[]
    months?: { value: string; label: string }[]
    birthDateSet?: boolean
    formatNumber: (n: number) => string
    /** Formats the financed remainder in the down-payment hint. */
    formatCurrency: (n: number) => string
  }

  let {
    item = $bindable(),
    idPrefix,
    showAdvanced,
    showTiming = false,
    currencyLabel,
    years = [],
    months = [],
    birthDateSet = true,
    formatNumber,
    formatCurrency,
  }: Props = $props()

  let paymentMethodItems = $derived(getPaymentMethodItems($_))

  let frequencyItems = $derived(getFrequencyItems($_))

  let valueOverTimeItems = $derived(getValueOverTimeItems($_))

  // The dialog asks for the down payment; the profile stores what is still
  // owed. One is the other's complement against the purchase price.
  let downPayment = $derived(
    item.value === undefined
      ? undefined
      : Math.max(item.value - (item.outstanding_balance ?? 0), 0),
  )

  function setDownPayment(paid: number | undefined): void {
    item.outstanding_balance = Math.max((item.value ?? 0) - (paid ?? 0), 0)
  }
</script>

{#if showTiming}
  <DateAgeSelector
    mode="start"
    label={$_('page.plan.purchase')}
    description={$_('page.plan.purchaseDescription')}
    value={item.purchase}
    year={item.purchase_year}
    month={item.purchase_month}
    age={item.purchase_age}
    {years}
    {months}
    {birthDateSet}
    {formatNumber}
    onValueChange={(v) => {
      item.purchase = v
    }}
    onYearChange={(v) => {
      item.purchase_year = v
    }}
    onMonthChange={(v) => {
      item.purchase_month = v
    }}
    onAgeChange={(v) => {
      item.purchase_age = v
    }}
  />
{/if}

<div class="flex items-end gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label for="{idPrefix}-purchasePrice">{$_('page.plan.purchasePrice')}</Label>
    <SuffixedInput
      id="{idPrefix}-purchasePrice"
      value={item.value}
      suffix={currencyLabel}
      {formatNumber}
      onValueChange={(v) => {
        item.value = v
      }}
    />
  </div>
  <div class="flex flex-1 flex-col gap-2">
    <Label for="{idPrefix}-paymentMethod">{$_('page.plan.paymentMethod')}</Label>
    <SelectField
      id="{idPrefix}-paymentMethod"
      value={item.status}
      items={paymentMethodItems}
      onValueChange={(v) => {
        if (v) item.status = v
      }}
    />
  </div>
</div>

{#if item.status === 'financed'}
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-downPayment">{$_('page.plan.downPayment')}</Label>
      <SuffixedInput
        id="{idPrefix}-downPayment"
        value={downPayment}
        suffix={currencyLabel}
        {formatNumber}
        onValueChange={setDownPayment}
      />
    </div>
    <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
      {$_('page.plan.downPaymentDescription', {
        values: { amount: formatCurrency(item.outstanding_balance ?? 0) },
      })}
    </p>
  </div>

  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-installmentFrequency">
        {$_('page.setup.tangibleAssets.installmentFrequency')}
      </Label>
      <SelectField
        id="{idPrefix}-installmentFrequency"
        value={item.installment_frequency}
        items={frequencyItems}
        onValueChange={(v) => {
          if (v) item.installment_frequency = v
        }}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-annualRate">{$_('page.setup.tangibleAssets.annualRate')}</Label>
      <SuffixedInput
        id="{idPrefix}-annualRate"
        value={item.annual_rate}
        suffix="%"
        {formatNumber}
        onValueChange={(v) => {
          item.annual_rate = v
        }}
      />
    </div>
  </div>

  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-installmentAmount">
        {$_('page.setup.tangibleAssets.installmentAmount')}
      </Label>
      <SuffixedInput
        id="{idPrefix}-installmentAmount"
        value={item.installment_amount}
        suffix={currencyLabel}
        {formatNumber}
        onValueChange={(v) => {
          item.installment_amount = v
        }}
      />
    </div>
    <span class="inline-flex h-8 items-center text-muted-foreground">
      <ArrowLeftRight class="size-4" />
    </span>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-term">{$_('page.plan.term')}</Label>
      <SuffixedInput
        id="{idPrefix}-term"
        value={item.remaining_term}
        suffix={item.remaining_term_unit === 'months'
          ? $_('page.setup.common.months')
          : $_('page.setup.tangibleAssets.years', {
              values: { count: item.remaining_term ?? 0 },
            })}
        {formatNumber}
        onValueChange={(v) => {
          item.remaining_term = v
        }}
      />
    </div>
  </div>
{/if}

{#if showTiming}
  <DateAgeSelector
    mode="end"
    label={$_('page.plan.sale')}
    neverLabel={$_('page.plan.saleNever')}
    description={$_('page.plan.saleDescription')}
    value={item.sale}
    year={item.sale_year}
    month={item.sale_month}
    age={item.sale_age}
    {years}
    {months}
    {birthDateSet}
    {formatNumber}
    onValueChange={(v) => {
      item.sale = v
    }}
    onYearChange={(v) => {
      item.sale_year = v
    }}
    onMonthChange={(v) => {
      item.sale_month = v
    }}
    onAgeChange={(v) => {
      item.sale_age = v
    }}
  />
{/if}

{#if showAdvanced}
  <Separator />

  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-valueOverTime">{$_('page.plan.valueOverTime')}</Label>
      <SelectField
        id="{idPrefix}-valueOverTime"
        value={item.value_over_time}
        items={valueOverTimeItems}
        onValueChange={(v) => {
          if (v) item.value_over_time = v
        }}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-valueRate">{$_('page.plan.valueAnnualRate')}</Label>
      <SuffixedInput
        id="{idPrefix}-valueRate"
        value={item.value_rate}
        suffix="%"
        {formatNumber}
        onValueChange={(v) => {
          item.value_rate = v
        }}
      />
    </div>
  </div>

  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-propertyTax">{$_('page.plan.propertyTax')}</Label>
      <SuffixedInput
        id="{idPrefix}-propertyTax"
        value={item.property_tax_rate}
        suffix="%"
        {formatNumber}
        onValueChange={(v) => {
          item.property_tax_rate = v
        }}
      />
    </div>
    <HelpTooltip text={$_('page.plan.propertyTaxDescription')} class="mb-2" />
  </div>
{/if}
