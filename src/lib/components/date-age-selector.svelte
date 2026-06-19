<script lang="ts">
  import { _ } from 'svelte-i18n'

  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'

  interface Props {
    mode: 'start' | 'end'
    value: string
    year: number | undefined
    month: number | undefined
    age: number | undefined
    years: string[]
    months: { value: string; label: string }[]
    /**
     * Overrides the option-aware description. When omitted, the description
     * derives from the selected option using shared i18n keys (matches the
     * Figma spec at node 233:6637).
     */
    description?: string
    onValueChange: (v: string) => void
    onYearChange: (v: number | undefined) => void
    onMonthChange: (v: number | undefined) => void
    onAgeChange: (v: number | undefined) => void
    formatNumber?: (n: number) => string
  }

  let {
    mode,
    value,
    year,
    month,
    age,
    years,
    months,
    description,
    onValueChange,
    onYearChange,
    onMonthChange,
    onAgeChange,
    formatNumber,
  }: Props = $props()

  let label = $derived(
    mode === 'start' ? $_('page.setup.common.start') : $_('page.setup.common.end'),
  )

  // Option-aware description: shown next to the dropdown when the selected
  // option doesn't have its own input (i.e. not 'at_specific_date' or
  // 'when_age_is'). Callers can override via the `description` prop.
  let computedDescription = $derived.by(() => {
    if (value === 'immediately') return $_('page.setup.common.immediatelyDescription')
    if (value === 'now') return $_('page.setup.common.nowDescription')
    if (value === 'never') return $_('page.setup.common.neverDescription')
    return ''
  })
  let effectiveDescription = $derived(description ?? computedDescription)

  let yearString = $derived(year !== undefined ? String(year) : '')
  let monthString = $derived(month !== undefined ? String(month) : '')

  let modeItems = $derived(
    mode === 'start'
      ? [
          { value: 'immediately', label: $_('page.setup.common.immediately') },
          { value: 'now', label: $_('page.setup.common.now') },
          { value: 'at_specific_date', label: $_('page.setup.common.atSpecificDate') },
          { value: 'when_age_is', label: $_('page.setup.common.whenAgeIs') },
        ]
      : [
          { value: 'never', label: $_('page.setup.common.never') },
          { value: 'at_specific_date', label: $_('page.setup.common.atSpecificDate') },
          { value: 'when_age_is', label: $_('page.setup.common.whenAgeIs') },
        ],
  )
  let yearItems = $derived(years.map((y) => ({ value: y, label: y })))
</script>

<div class="flex items-end gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label>{label}</Label>
    <SelectField
      {value}
      items={modeItems}
      onValueChange={(v) => {
        if (v) onValueChange(v)
      }}
    />
  </div>
  {#if value === 'at_specific_date'}
    <div class="flex flex-1 items-center gap-2">
      <SelectField
        class="max-w-24"
        value={yearString}
        items={yearItems}
        onValueChange={(v) => {
          if (v) onYearChange(Number(v))
        }}
      />
      <SelectField
        value={monthString}
        items={months}
        onValueChange={(v) => {
          if (v) onMonthChange(Number(v))
        }}
      />
    </div>
  {:else if value === 'when_age_is'}
    <div class="flex flex-1 flex-col gap-2">
      <SuffixedInput
        value={age}
        suffix={$_('page.setup.common.yearsOld')}
        {formatNumber}
        onValueChange={onAgeChange}
      />
    </div>
  {:else}
    <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
      {effectiveDescription}
    </p>
  {/if}
</div>
