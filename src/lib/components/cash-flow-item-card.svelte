<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import type { CashFlowEnd, CashFlowStart, ChangeOverTime, Frequency } from '$lib/schemas'
  import { sameYearMonthsInverted } from '$lib/schemas'
  import { getFrequencyItems, getFrequencyShortLabel } from '$lib/select-options'

  interface CashFlowItem {
    id: string
    name: string
    amount: number | undefined
    frequency: Frequency
    showAdvanced: boolean
    start: CashFlowStart
    start_year?: number
    start_month?: number
    start_age?: number
    end: CashFlowEnd
    end_year?: number
    end_month?: number
    end_age?: number
    change_over_time: ChangeOverTime
    change_percentage?: number
    editing: boolean
  }

  interface Props {
    item: CashFlowItem
    suffix: string
    sentiment: 'positive' | 'negative'
    startDescription: string
    endDescription: string
    changeDescription: string
    years: string[]
    months: { value: string; label: string }[]
    formatCurrency: (value: number) => string
    formatNumber: (value: number) => string
    onToggleEditing: () => void
    onDuplicate: () => void
    onDelete: () => void
    extraAdvancedContent?: Snippet
  }

  let {
    item,
    suffix,
    sentiment,
    startDescription,
    endDescription,
    changeDescription,
    years,
    months,
    formatCurrency,
    formatNumber,
    onToggleEditing,
    onDuplicate,
    onDelete,
    extraAdvancedContent,
  }: Props = $props()

  let frequencyItems = $derived(getFrequencyItems($_))

  // Same-year ranges can't end before they start: months before the start
  // month are disabled in the end dropdown, and an end month that a later
  // start/year change turned invalid is cleared so the user picks again
  // (the editors' auto-save skips the item until they do).
  let endMinMonth = $derived(
    item.start === 'at_specific_date' &&
      item.end === 'at_specific_date' &&
      item.start_year !== undefined &&
      item.start_year === item.end_year
      ? item.start_month
      : undefined,
  )
  $effect(() => {
    if (
      sameYearMonthsInverted(
        item.start,
        item.start_year,
        item.start_month,
        item.end,
        item.end_year,
        item.end_month,
      )
    ) {
      item.end_month = undefined
    }
  })

  let sign = $derived(sentiment === 'positive' ? '+' : '-')
  let collapsedValueClass = $derived(sentiment === 'positive' ? 'text-success' : 'text-destructive')
  let formattedAmount = $derived.by(() => {
    if (item.amount === undefined || item.amount === 0) return ''
    return `${sign}${formatCurrency(item.amount)} / ${getFrequencyShortLabel($_, item.frequency)}`
  })
</script>

<EditableItemCard
  {item}
  collapsedValue={formattedAmount}
  {collapsedValueClass}
  {onToggleEditing}
  {onDuplicate}
  {onDelete}
>
  {#snippet expandedContent()}
    <!-- Amount and Frequency row -->
    <div class="flex items-center gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="amount-{item.id}">{$_('page.setup.common.amount')}</Label>
        <SuffixedInput
          id="amount-{item.id}"
          value={item.amount}
          {suffix}
          {formatNumber}
          onValueChange={(v) => {
            item.amount = v
          }}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label for="frequency-{item.id}">{$_('page.setup.common.frequency')}</Label>
        <SelectField
          id="frequency-{item.id}"
          value={item.frequency}
          items={frequencyItems}
          onValueChange={(v) => {
            if (v) item.frequency = v
          }}
        />
      </div>
    </div>

    <!-- Advanced options toggle -->
    <div class="flex cursor-pointer items-center gap-2">
      <Switch
        checked={item.showAdvanced}
        onCheckedChange={(v) => {
          item.showAdvanced = v
        }}
      />
      <span class="text-sm font-medium">{$_('page.setup.common.advancedOptions')}</span>
    </div>

    <!-- Advanced options content -->
    {#if item.showAdvanced}
      <Separator />

      {#if extraAdvancedContent}
        {@render extraAdvancedContent()}
        <Separator />
      {/if}

      <!-- Start -->
      <DateAgeSelector
        mode="start"
        value={item.start}
        year={item.start_year}
        month={item.start_month}
        age={item.start_age}
        {years}
        {months}
        description={startDescription}
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

      <!-- End -->
      <DateAgeSelector
        mode="end"
        value={item.end}
        year={item.end_year}
        month={item.end_month}
        age={item.end_age}
        {years}
        {months}
        minMonth={endMinMonth}
        description={endDescription}
        {formatNumber}
        onValueChange={(v) => {
          item.end = v
        }}
        onYearChange={(v) => {
          item.end_year = v
        }}
        onMonthChange={(v) => {
          item.end_month = v
        }}
        onAgeChange={(v) => {
          item.end_age = v
        }}
      />

      <!-- Change over time -->
      <ChangeOverTimeSelector
        value={item.change_over_time}
        percentage={item.change_percentage}
        {changeDescription}
        {formatNumber}
        onValueChange={(v) => {
          item.change_over_time = v
        }}
        onPercentageChange={(v) => {
          item.change_percentage = v
        }}
      />
    {/if}
  {/snippet}
</EditableItemCard>
