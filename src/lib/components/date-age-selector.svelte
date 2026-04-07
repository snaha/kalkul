<script lang="ts">
  import { _ } from 'svelte-i18n'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'

  interface Props {
    mode: 'start' | 'end'
    value: string
    year: string
    month: string
    age: string
    years: string[]
    months: { value: string; label: string }[]
    description: string
    onValueChange: (v: string) => void
    onYearChange: (v: string) => void
    onMonthChange: (v: string) => void
    onAgeChange: (v: string) => void
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
  }: Props = $props()

  let label = $derived(
    mode === 'start' ? $_('page.setup.common.start') : $_('page.setup.common.end'),
  )

  let displayValue = $derived.by(() => {
    if (mode === 'start') {
      if (value === 'immediately') return $_('page.setup.common.immediately')
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
        value={year}
        onValueChange={(v) => {
          if (v) onYearChange(v)
        }}
      >
        <Select.Trigger class="w-full max-w-24">{year}</Select.Trigger>
        <Select.Content>
          {#each years as y (y)}
            <Select.Item value={y}>{y}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Select.Root
        type="single"
        value={month}
        onValueChange={(v) => {
          if (v) onMonthChange(v)
        }}
      >
        <Select.Trigger class="w-full">
          {months[Number(month)]?.label}
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
        oninput={(e) => {
          onAgeChange((e.currentTarget as HTMLInputElement).value)
        }}
      />
    </div>
  {:else}
    <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
      {description}
    </p>
  {/if}
</div>
