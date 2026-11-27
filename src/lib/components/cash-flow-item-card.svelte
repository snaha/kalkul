<script lang="ts">
  import { _ } from 'svelte-i18n'

  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import RepeatEverySelector from '$lib/components/repeat-every-selector.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import type { Frequency } from '$lib/schemas'
  import { getFrequencyShortLabel } from '$lib/select-options'

  // Financial data records the current state: amount, frequency and whether it
  // keeps pace with inflation. Start/End/Change over time belong to the plan
  // dialog (matches the Figma financial-data cards). The frequency is optional
  // only because the shared stored shape allows a one-time schedule, which
  // financial data never holds, so it reads back as monthly.
  interface CashFlowItem {
    id: string
    name: string
    amount: number | undefined
    frequency?: Frequency
    repeat_every?: number
    inflation_adjusted?: boolean
    editing: boolean
  }

  interface Props {
    item: CashFlowItem
    suffix: string
    sentiment: 'positive' | 'negative'
    formatCurrencyCode: (value: number) => string
    formatNumber: (value: number) => string
    amountLabel?: string
    onToggleEditing: () => void
    onDuplicate: () => void
    onDelete: () => void
  }

  let {
    item,
    suffix,
    sentiment,
    formatCurrencyCode,
    formatNumber,
    amountLabel,
    onToggleEditing,
    onDuplicate,
    onDelete,
  }: Props = $props()

  let sign = $derived(sentiment === 'positive' ? '+' : '-')
  let collapsedValueClass = $derived(sentiment === 'positive' ? 'text-success' : 'text-destructive')
  let formattedAmount = $derived.by(() => {
    if (item.amount === undefined || item.amount === 0) return ''
    return `${sign}${formatCurrencyCode(item.amount)} / ${getFrequencyShortLabel($_, item.frequency ?? 'monthly', item.repeat_every)}`
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
        <Label for="amount-{item.id}">{amountLabel ?? $_('page.setup.common.amount')}</Label>
        <SuffixedInput
          id="amount-{item.id}"
          value={item.amount}
          suffix="{suffix}/{getFrequencyShortLabel(
            $_,
            item.frequency ?? 'monthly',
            item.repeat_every,
          )}"
          {formatNumber}
          onValueChange={(v) => {
            item.amount = v
          }}
        />
      </div>
      <RepeatEverySelector
        id="repeatEvery-{item.id}"
        every={item.repeat_every}
        frequency={item.frequency ?? 'monthly'}
        {formatNumber}
        onEveryChange={(v) => {
          item.repeat_every = v
        }}
        onFrequencyChange={(v) => {
          item.frequency = v
        }}
      />
    </div>

    <!-- Adjust for inflation toggle -->
    <InflationAdjustToggle
      checked={item.inflation_adjusted ?? false}
      onCheckedChange={(v) => {
        item.inflation_adjusted = v
      }}
    />
  {/snippet}
</EditableItemCard>
