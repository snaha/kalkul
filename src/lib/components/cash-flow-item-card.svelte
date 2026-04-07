<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'

  interface CashFlowItem {
    id: string
    name: string
    amount: string
    frequency: string
    showAdvanced: boolean
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

  interface Props {
    item: CashFlowItem
    currencyLabel: string
    amountColor: 'green' | 'destructive'
    startDescription: string
    endDescription: string
    matchInflationDescription: string
    changeDescription: string
    years: string[]
    months: { value: string; label: string }[]
    formatAmount: (amount: string) => string
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
    amountColor,
    startDescription,
    endDescription,
    matchInflationDescription,
    changeDescription,
    years,
    months,
    formatAmount,
    onToggleEditing,
    onDuplicate,
    onDelete,
    onStartEditingName,
    onStopEditingName,
    extraAdvancedContent,
  }: Props = $props()

  let collapsedValueClass = $derived(
    amountColor === 'green' ? 'text-green-600' : 'text-destructive',
  )
</script>

<EditableItemCard
  {item}
  collapsedValue={formatAmount(item.amount)}
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
          oninput={(e) => {
            item.amount = (e.currentTarget as HTMLInputElement).value
          }}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label>{$_('page.setup.common.frequency')}</Label>
        <Select.Root
          type="single"
          value={item.frequency}
          onValueChange={(v) => {
            if (v) item.frequency = v
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
        year={item.startYear}
        month={item.startMonth}
        age={item.startAge}
        {years}
        {months}
        description={startDescription}
        onValueChange={(v) => {
          item.start = v
        }}
        onYearChange={(v) => {
          item.startYear = v
        }}
        onMonthChange={(v) => {
          item.startMonth = v
        }}
        onAgeChange={(v) => {
          item.startAge = v
        }}
      />

      <!-- End -->
      <DateAgeSelector
        mode="end"
        value={item.end}
        year={item.endYear}
        month={item.endMonth}
        age={item.endAge}
        {years}
        {months}
        description={endDescription}
        onValueChange={(v) => {
          item.end = v
        }}
        onYearChange={(v) => {
          item.endYear = v
        }}
        onMonthChange={(v) => {
          item.endMonth = v
        }}
        onAgeChange={(v) => {
          item.endAge = v
        }}
      />

      <!-- Change over time -->
      <ChangeOverTimeSelector
        value={item.changeOverTime}
        percentage={item.changePercentage}
        {matchInflationDescription}
        {changeDescription}
        onValueChange={(v) => {
          item.changeOverTime = v
        }}
        onPercentageChange={(v) => {
          item.changePercentage = v
        }}
      />
    {/if}
  {/snippet}
</EditableItemCard>
