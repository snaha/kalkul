<script lang="ts" generics="T extends string">
  import { _ } from 'svelte-i18n'

  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'

  interface Props {
    mode: 'start' | 'end'
    // The timing enum of the caller's field (CashFlowStart for mode 'start',
    // CashFlowEnd for mode 'end') — onValueChange fires with that type so
    // call sites need no casts.
    value: T
    year: number | undefined
    month: number | undefined
    age: number | undefined
    years: string[]
    months: { value: string; label: string }[]
    /**
     * Whether the profile has a birth date. Age-based timing ('when_age_is')
     * can't resolve to a year without one, so the option is disabled when this
     * is false to avoid a transfer/cash-flow silently starting at plan year 1.
     */
    birthDateSet?: boolean
    /** Overrides the field label ("Start"/"End"), e.g. "Exit" on investments. */
    label?: string
    /** Overrides the 'never' option label, e.g. "Hold — no planned exit". */
    neverLabel?: string
    /**
     * Overrides the option-aware description. When omitted, the description
     * derives from the selected option using shared i18n keys (matches the
     * Figma spec at node 233:6637).
     */
    description?: string
    /**
     * Disables month options before this month. Passed to an end selector
     * when the start is a specific date in the same year, so a range that
     * ends before it starts can't be picked.
     */
    minMonth?: number
    onValueChange: (v: T) => void
    onYearChange: (v: number | undefined) => void
    onMonthChange: (v: number | undefined) => void
    onAgeChange: (v: number | undefined) => void
    formatNumber: (n: number) => string
  }

  const uid = $props.id()

  let {
    mode,
    value,
    year,
    month,
    age,
    years,
    months,
    birthDateSet = true,
    label: labelOverride,
    neverLabel,
    description,
    minMonth,
    onValueChange,
    onYearChange,
    onMonthChange,
    onAgeChange,
    formatNumber,
  }: Props = $props()

  let label = $derived(
    labelOverride ??
      (mode === 'start' ? $_('page.setup.common.start') : $_('page.setup.common.end')),
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

  // Age-based timing needs a birth date to resolve to a year; disable it when
  // none is set so the flow can't silently start at the plan's first year.
  let whenAgeIsItem = $derived({
    value: 'when_age_is',
    label: $_('page.setup.common.whenAgeIs'),
    disabled: !birthDateSet,
  })
  // The literals below are the CashFlowStart/CashFlowEnd members for the
  // respective mode; TypeScript can't correlate `mode` with `T`, so this one
  // cast stands in for the per-call-site casts it removes.
  let modeItems = $derived(
    (mode === 'start'
      ? [
          { value: 'immediately', label: $_('page.setup.common.immediately') },
          { value: 'now', label: $_('page.setup.common.now') },
          { value: 'at_specific_date', label: $_('page.setup.common.atSpecificDate') },
          whenAgeIsItem,
        ]
      : [
          { value: 'never', label: neverLabel ?? $_('page.setup.common.never') },
          { value: 'at_specific_date', label: $_('page.setup.common.atSpecificDate') },
          whenAgeIsItem,
        ]) as SelectFieldItem<T>[],
  )
  let yearItems = $derived(years.map((y) => ({ value: y, label: y })))
  let monthItems = $derived(
    minMonth === undefined
      ? months
      : months.map((m) => ({ ...m, disabled: Number(m.value) < minMonth })),
  )
</script>

<div class="flex items-end gap-2">
  <div class="flex flex-1 flex-col gap-2">
    <Label for="{uid}-mode">{label}</Label>
    <SelectField
      id="{uid}-mode"
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
        aria-label={$_('page.setup.aboutYou.selectYear')}
        value={yearString}
        items={yearItems}
        onValueChange={(v) => {
          if (v) onYearChange(Number(v))
        }}
      />
      <SelectField
        aria-label={$_('page.setup.aboutYou.selectMonth')}
        value={monthString}
        items={monthItems}
        onValueChange={(v) => {
          if (v) onMonthChange(Number(v))
        }}
      />
    </div>
  {:else if value === 'when_age_is'}
    <div class="flex flex-1 flex-col gap-2">
      <SuffixedInput
        value={age}
        aria-label={$_('page.setup.common.whenAgeIs')}
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
