<script lang="ts">
  import { _ } from 'svelte-i18n'

  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import type { Frequency } from '$lib/schemas'

  interface Props {
    id: string
    /** How many periods between two payments; absent means every period. */
    every: number | undefined
    frequency: Frequency
    formatNumber: (n: number) => string
    onEveryChange: (every: number | undefined) => void
    onFrequencyChange: (frequency: Frequency) => void
  }

  let { id, every, frequency, formatNumber, onEveryChange, onFrequencyChange }: Props = $props()

  // "month" beside a 1, "months" beside anything else.
  let count = $derived(every ?? 1)
  let unitItems: SelectFieldItem<Frequency>[] = $derived([
    { value: 'monthly', label: $_('page.setup.common.repeatMonths', { values: { count } }) },
    { value: 'yearly', label: $_('page.setup.common.repeatYears', { values: { count } }) },
    // Weeks are no longer offered; a flow stored as weekly keeps its unit
    // until the user picks another.
    ...(frequency === 'weekly'
      ? [
          {
            value: 'weekly' as const,
            label: $_('page.setup.common.repeatWeeks', { values: { count } }),
          },
        ]
      : []),
  ])
</script>

<!-- Figma "Repeat every" (938:64258): a count and its unit, in place of the
     Frequency select. -->
<div class="flex flex-1 flex-col gap-2">
  <Label for={id}>{$_('page.setup.common.repeatEvery')}</Label>
  <div class="grid grid-cols-2 gap-2">
    <SuffixedInput
      {id}
      value={count}
      placeholder="1"
      {formatNumber}
      onValueChange={(v) => {
        // A whole number of periods; 1 is the default and is not stored.
        const whole = v === undefined ? 1 : Math.round(v)
        onEveryChange(whole > 1 ? whole : undefined)
      }}
    />
    <div>
      <SelectField
        class="w-full"
        value={frequency}
        items={unitItems}
        aria-label={$_('page.setup.common.repeatUnit')}
        onValueChange={(v) => {
          if (v) onFrequencyChange(v)
        }}
      />
    </div>
  </div>
</div>
