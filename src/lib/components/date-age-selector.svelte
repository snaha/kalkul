<script lang="ts">
  import { _ } from 'svelte-i18n'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'

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

  let displayValue = $derived.by(() => {
    if (mode === 'start') {
      if (value === 'immediately') return $_('page.setup.common.immediately')
      if (value === 'now') return $_('page.setup.common.now')
      if (value === 'at_specific_date') return $_('page.setup.common.atSpecificDate')
      if (value === 'when_age_is') return $_('page.setup.common.whenAgeIs')
      return $_('page.setup.common.immediately')
    }
    if (value === 'never') return $_('page.setup.common.never')
    if (value === 'at_specific_date') return $_('page.setup.common.atSpecificDate')
    if (value === 'when_age_is') return $_('page.setup.common.whenAgeIs')
    return $_('page.setup.common.never')
  })

  let defaultOption = $derived(mode === 'start' ? 'immediately' : 'never')
  let defaultLabel = $derived(
    mode === 'start' ? $_('page.setup.common.immediately') : $_('page.setup.common.never'),
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
</script>

<div class="flex items-end gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label>{label}</Label>
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
        <Select.Item value={defaultOption}>{defaultLabel}</Select.Item>
        {#if mode === 'start'}
          <Select.Item value="now">{$_('page.setup.common.now')}</Select.Item>
        {/if}
        <Select.Item value="at_specific_date">
          {$_('page.setup.common.atSpecificDate')}
        </Select.Item>
        <Select.Item value="when_age_is">
          {$_('page.setup.common.whenAgeIs')}
        </Select.Item>
      </Select.Content>
    </Select.Root>
  </div>
  {#if value === 'at_specific_date'}
    <div class="flex flex-1 items-center gap-2">
      <Select.Root
        type="single"
        value={yearString}
        onValueChange={(v) => {
          if (v) onYearChange(Number(v))
        }}
      >
        <Select.Trigger class="w-full max-w-24">{yearString}</Select.Trigger>
        <Select.Content>
          {#each years as y (y)}
            <Select.Item value={y}>{y}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Select.Root
        type="single"
        value={monthString}
        onValueChange={(v) => {
          if (v) onMonthChange(Number(v))
        }}
      >
        <Select.Trigger class="w-full">
          {month !== undefined ? months[month]?.label : ''}
        </Select.Trigger>
        <Select.Content>
          {#each months as m (m.value)}
            <Select.Item value={m.value}>{m.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
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
