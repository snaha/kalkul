<script lang="ts">
  import { _ } from 'svelte-i18n'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'

  interface Props {
    value: string
    percentage: number | undefined
    /**
     * Override for the description shown when the dropdown is 'none'.
     * Defaults to a shared i18n key.
     */
    changeDescription?: string
    formatNumber?: (n: number) => string
    onValueChange: (v: string) => void
    onPercentageChange: (v: number | undefined) => void
  }

  let {
    value,
    percentage,
    changeDescription,
    formatNumber,
    onValueChange,
    onPercentageChange,
  }: Props = $props()

  // 'match_inflation' is no longer offered as a dropdown choice (the
  // Adjust-for-inflation toggle covers that case); we keep it out of both the
  // displayed value and the option list. Legacy data carrying the old value
  // still renders as 'None' here, while the calculation honors it via the
  // legacy fallback in growthFactor.
  let displayValue = $derived.by(() => {
    if (value === 'increase_yearly') return $_('page.setup.common.increaseYearlyBy')
    if (value === 'decrease_yearly') return $_('page.setup.common.decreaseYearlyBy')
    return $_('page.setup.common.none')
  })

  let descriptionText = $derived(changeDescription ?? $_('page.setup.common.noneDescription'))
</script>

<div class="flex items-end gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label>{$_('page.setup.common.changeOverTime')}</Label>
    <Select.Root
      type="single"
      {value}
      onValueChange={(v) => {
        if (v) onValueChange(v)
      }}
    >
      <Select.Trigger class="w-full">
        {displayValue}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="none">{$_('page.setup.common.none')}</Select.Item>
        <Select.Item value="increase_yearly">
          {$_('page.setup.common.increaseYearlyBy')}
        </Select.Item>
        <Select.Item value="decrease_yearly">
          {$_('page.setup.common.decreaseYearlyBy')}
        </Select.Item>
      </Select.Content>
    </Select.Root>
  </div>
  {#if value === 'increase_yearly' || value === 'decrease_yearly'}
    <div class="flex flex-1 flex-col gap-2">
      <SuffixedInput
        value={percentage}
        suffix="%"
        {formatNumber}
        onValueChange={onPercentageChange}
      />
    </div>
  {:else}
    <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
      {descriptionText}
    </p>
  {/if}
</div>
