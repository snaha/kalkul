<script lang="ts">
  import { _ } from 'svelte-i18n'

  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'

  interface Props {
    value: string
    percentage: number | undefined
    /**
     * Override for the description shown when the dropdown is 'none'.
     * Defaults to a shared i18n key.
     */
    changeDescription?: string
    formatNumber: (n: number) => string
    onValueChange: (v: string) => void
    onPercentageChange: (v: number | undefined) => void
  }

  const uid = $props.id()

  let {
    value,
    percentage,
    changeDescription,
    formatNumber,
    onValueChange,
    onPercentageChange,
  }: Props = $props()

  // 'match_inflation' is no longer offered as a dropdown choice (the
  // Adjust-for-inflation toggle covers that case); we keep it out of the option
  // list. Legacy data carrying the old value still renders as 'None' here, while
  // the calculation honors it via the legacy fallback in growthFactor.
  let changeItems = $derived([
    { value: 'none', label: $_('page.setup.common.none') },
    { value: 'increase_yearly', label: $_('page.setup.common.increaseYearlyBy') },
    { value: 'decrease_yearly', label: $_('page.setup.common.decreaseYearlyBy') },
  ])

  let descriptionText = $derived(changeDescription ?? $_('page.setup.common.noneDescription'))
</script>

<div class="flex items-end gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label for="{uid}-change">{$_('page.setup.common.changeOverTime')}</Label>
    <SelectField
      id="{uid}-change"
      value={changeItems.some((i) => i.value === value) ? value : 'none'}
      items={changeItems}
      onValueChange={(v) => {
        if (v) onValueChange(v)
      }}
    />
  </div>
  {#if value === 'increase_yearly' || value === 'decrease_yearly'}
    <div class="flex flex-1 flex-col gap-2">
      <SuffixedInput
        value={percentage}
        aria-label={$_('page.setup.common.changePercentage')}
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
