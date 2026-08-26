<script lang="ts">
  import { _ } from 'svelte-i18n'

  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import type { CashFlowEnd, CashFlowStart, EntryFeeType, ExitFeeType } from '$lib/schemas'
  import { getEntryFeeTypeItems, getExitFeeTypeItems } from '$lib/select-options'

  /**
   * The editable shape both call sites share. The setup card and the plan
   * dialog keep their own container state; this is only the part they edit.
   */
  export interface InvestmentFieldsItem {
    balance: number | undefined
    apy: number | undefined
    ter: number | undefined
    entry_fee: number | undefined
    entry_fee_type: EntryFeeType
    exit_fee: number | undefined
    exit_fee_type: ExitFeeType
    start: CashFlowStart
    start_year: number | undefined
    start_month: number | undefined
    start_age: number | undefined
    exit: CashFlowEnd
    exit_year: number | undefined
    exit_month: number | undefined
    exit_age: number | undefined
  }

  interface Props {
    /** Bindable: this component writes the edited values straight back. */
    item: InvestmentFieldsItem
    /** Namespaces the input ids, since several of these can be on one page. */
    idPrefix: string
    /** "Current balance" in the setup card, "Initial amount" in the plan dialog. */
    amountLabel: string
    /** Whether the fee fields are revealed. */
    showAdvanced: boolean
    /**
     * Start/Exit selectors. Only the plan dialog plans an investment in time;
     * the setup card edits holdings the user already has.
     */
    showTiming?: boolean
    currencyLabel: string
    years?: string[]
    months?: { value: string; label: string }[]
    birthDateSet?: boolean
    formatNumber: (n: number) => string
  }

  let {
    item = $bindable(),
    idPrefix,
    amountLabel,
    showAdvanced,
    showTiming = false,
    currencyLabel,
    years = [],
    months = [],
    birthDateSet = true,
    formatNumber,
  }: Props = $props()

  let entryFeeTypeItems = $derived(getEntryFeeTypeItems($_))

  let exitFeeTypeItems = $derived(getExitFeeTypeItems($_))
</script>

{#if showTiming}
  <DateAgeSelector
    mode="start"
    label={$_('page.plan.investmentStart')}
    description={$_('page.plan.investmentStartDescription')}
    value={item.start}
    year={item.start_year}
    month={item.start_month}
    age={item.start_age}
    {years}
    {months}
    {birthDateSet}
    {formatNumber}
    onValueChange={(v) => {
      item.start = v
    }}
    onYearChange={(v) => {
      item.start_year = v
    }}
    onMonthChange={(v) => {
      item.start_month = v
    }}
    onAgeChange={(v) => {
      item.start_age = v
    }}
  />
{/if}

<div class="flex items-center gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label for="{idPrefix}-balance">{amountLabel}</Label>
    <SuffixedInput
      id="{idPrefix}-balance"
      value={item.balance}
      suffix={currencyLabel}
      {formatNumber}
      onValueChange={(v) => {
        item.balance = v
      }}
    />
  </div>
  <div class="flex w-32 flex-col gap-2">
    <Label for="{idPrefix}-apy">{$_('page.setup.investments.apy')}</Label>
    <SuffixedInput
      id="{idPrefix}-apy"
      value={item.apy}
      suffix="%"
      {formatNumber}
      onValueChange={(v) => {
        item.apy = v
      }}
    />
  </div>
</div>

{#if showTiming}
  <DateAgeSelector
    mode="end"
    label={$_('page.plan.investmentExit')}
    neverLabel={$_('page.plan.investmentExitNever')}
    description={$_('page.plan.investmentExitDescription')}
    value={item.exit}
    year={item.exit_year}
    month={item.exit_month}
    age={item.exit_age}
    {years}
    {months}
    {birthDateSet}
    {formatNumber}
    onValueChange={(v) => {
      item.exit = v
    }}
    onYearChange={(v) => {
      item.exit_year = v
    }}
    onMonthChange={(v) => {
      item.exit_month = v
    }}
    onAgeChange={(v) => {
      item.exit_age = v
    }}
  />
{/if}

{#if showAdvanced}
  <Separator />

  <!-- Total expense ratio -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-ter">{$_('page.plan.totalExpenseRatio')}</Label>
      <SuffixedInput
        id="{idPrefix}-ter"
        value={item.ter}
        suffix="%"
        {formatNumber}
        onValueChange={(v) => {
          item.ter = v
        }}
      />
    </div>
    <HelpTooltip text={$_('page.plan.totalExpenseRatioDescription')} class="mb-2" />
  </div>

  <!-- Entry fee + payment type -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-entryFee">{$_('page.plan.entryFee')}</Label>
      <SuffixedInput
        id="{idPrefix}-entryFee"
        value={item.entry_fee}
        suffix="%"
        {formatNumber}
        onValueChange={(v) => {
          item.entry_fee = v
        }}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-entryFeeType">{$_('page.plan.entryFeePaymentType')}</Label>
      <SelectField
        id="{idPrefix}-entryFeeType"
        value={item.entry_fee_type}
        items={entryFeeTypeItems}
        onValueChange={(v) => {
          if (v) item.entry_fee_type = v
        }}
      />
    </div>
    <HelpTooltip text={$_('page.plan.entryFeeDescription')} class="mb-2" />
  </div>

  <!-- Exit fee type + value -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{idPrefix}-exitFeeType">{$_('page.plan.exitFee')}</Label>
      <SelectField
        id="{idPrefix}-exitFeeType"
        value={item.exit_fee_type}
        items={exitFeeTypeItems}
        onValueChange={(v) => {
          if (v) item.exit_fee_type = v
        }}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <SuffixedInput
        value={item.exit_fee}
        aria-label={$_('page.plan.exitFee')}
        suffix={item.exit_fee_type === 'fixed' ? currencyLabel : '%'}
        {formatNumber}
        onValueChange={(v) => {
          item.exit_fee = v
        }}
      />
    </div>
    <HelpTooltip text={$_('page.plan.exitFeeDescription')} class="mb-2" />
  </div>
{/if}
