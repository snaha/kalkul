<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _, locale } from 'svelte-i18n'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import type { CashFlowEnd, CashFlowStart, ChangeOverTime, Frequency } from '$lib/schemas'
  import { formatCurrency } from '$lib/utils'

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
    editingName: boolean
  }

  interface Props {
    item: CashFlowItem
    currencyLabel: string
    sentiment: 'positive' | 'negative'
    startDescription: string
    endDescription: string
    matchInflationDescription: string
    changeDescription: string
    years: string[]
    months: { value: string; label: string }[]
    onToggleEditing: () => void
    onDuplicate: () => void
    onDelete: () => void
    onStartEditingName: () => void
    onStopEditingName: () => void
    extraAdvancedContent?: Snippet
  }

  let {
    item,
    currencyLabel,
    sentiment,
    startDescription,
    endDescription,
    matchInflationDescription,
    changeDescription,
    years,
    months,
    onToggleEditing,
    onDuplicate,
    onDelete,
    onStartEditingName,
    onStopEditingName,
    extraAdvancedContent,
  }: Props = $props()

  let sign = $derived(sentiment === 'positive' ? '+' : '-')
  let collapsedValueClass = $derived(sentiment === 'positive' ? 'text-success' : 'text-destructive')
  let formattedAmount = $derived.by(() => {
    if (item.amount === undefined || item.amount === 0) return ''
    return `${sign}${formatCurrency(item.amount, currencyLabel, $locale ?? undefined)}`
  })
</script>

<EditableItemCard
  {item}
  collapsedValue={formattedAmount}
  {collapsedValueClass}
  {onToggleEditing}
  {onDuplicate}
  {onDelete}
  {onStartEditingName}
  {onStopEditingName}
>
  {#snippet expandedContent()}
    <!-- Amount and Frequency row -->
    <div class="flex items-center gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.common.amount')}</Label>
        <SuffixedInput
          value={item.amount}
          suffix={currencyLabel}
          onValueChange={(v) => {
            item.amount = v
          }}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.common.frequency')}</Label>
        <Select.Root
          type="single"
          value={item.frequency}
          onValueChange={(v) => {
            if (v) item.frequency = v as Frequency
          }}
        >
          <Select.Trigger class="w-full">
            {item.frequency === 'monthly'
              ? $_('page.setup.common.monthly')
              : item.frequency === 'yearly'
                ? $_('page.setup.common.yearly')
                : $_('page.setup.common.weekly')}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="monthly">{$_('page.setup.common.monthly')}</Select.Item>
            <Select.Item value="yearly">{$_('page.setup.common.yearly')}</Select.Item>
            <Select.Item value="weekly">{$_('page.setup.common.weekly')}</Select.Item>
          </Select.Content>
        </Select.Root>
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
        onValueChange={(v) => {
          item.start = v as CashFlowStart
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
        description={endDescription}
        onValueChange={(v) => {
          item.end = v as CashFlowEnd
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
        {matchInflationDescription}
        {changeDescription}
        onValueChange={(v) => {
          item.change_over_time = v as ChangeOverTime
        }}
        onPercentageChange={(v) => {
          item.change_percentage = v
        }}
      />
    {/if}
  {/snippet}
</EditableItemCard>
