<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import CircleHelp from '@lucide/svelte/icons/circle-help'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import { filterById } from '$lib/plan-projection'
  import { sameYearMonthsInverted, timingComplete } from '$lib/schemas'
  import type {
    CashFlowEnd,
    CashFlowStart,
    ChangeOverTime,
    Frequency,
    Transfer,
    TransferSchedule,
  } from '$lib/schemas'
  import { getFrequencyItems } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  import ItemEditDialogShell from './item-edit-dialog-shell.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial: Transfer | undefined
    plan: PortfolioStore
  }

  const uid = $props.id()

  let { open = $bindable(), onOpenChange, initial, plan }: Props = $props()

  interface FormState {
    id: string
    name: string
    from_asset_id: string
    to_asset_id: string
    amount: number | undefined
    transfer_all: boolean
    inflation_adjusted: boolean
    schedule: TransferSchedule
    // one-time
    transaction_year: number | undefined
    transaction_month: number | undefined
    // recurring
    frequency: Frequency
    start: CashFlowStart
    start_year: number | undefined
    start_month: number | undefined
    start_age: number | undefined
    end: CashFlowEnd
    end_year: number | undefined
    end_month: number | undefined
    end_age: number | undefined
    change_over_time: ChangeOverTime
    change_percentage: number | undefined
  }

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))
  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  // Transfers can only move between cash and investments. Tangible assets and
  // liabilities are intentionally excluded — selling/buying a house is more
  // naturally modelled as a one-off expense/income.
  // The list is filtered by plan inclusion via the same filterById the
  // projection uses, so the dropdowns and the projection see the same assets.
  const assetOptions = $derived<{ id: string; name: string }[]>([
    ...(plan.include_cash !== false && appStore.profile.cash_amount
      ? [{ id: 'cash', name: $_('page.plan.cashItem') }]
      : []),
    ...filterById(appStore.profile.investments, plan.included_investment_ids).map((inv) => ({
      id: inv.id,
      name: inv.name,
    })),
  ])

  function blankForm(): FormState {
    const counter = (plan.transfers ?? []).length + 1
    return {
      id: crypto.randomUUID(),
      name: $_('page.plan.defaultTransferName', { values: { index: counter } }),
      from_asset_id: '',
      to_asset_id: '',
      amount: undefined,
      transfer_all: false,
      // Default ON — mirrors the income/expense default so new transfers
      // keep their real value over time without the user having to flip it.
      inflation_adjusted: true,
      schedule: 'one_time',
      transaction_year: currentYear,
      transaction_month: currentMonth + 1,
      frequency: 'monthly',
      start: 'immediately',
      // Timing fields start empty so 'at_specific_date'/'when_age_is' force an
      // explicit choice instead of silently defaulting to "now" (= plan year 1).
      start_year: undefined,
      start_month: undefined,
      start_age: undefined,
      end: 'never',
      end_year: undefined,
      end_month: undefined,
      end_age: undefined,
      change_over_time: 'none',
      change_percentage: undefined,
    }
  }

  function seedForm(src: Transfer | undefined): FormState {
    if (!src) return blankForm()
    const f = blankForm()
    f.id = src.id
    f.name = src.name
    f.from_asset_id = src.from_asset_id
    f.to_asset_id = src.to_asset_id
    f.amount = src.amount > 0 ? src.amount : undefined
    f.transfer_all = src.transfer_all ?? false
    f.schedule = src.schedule
    f.transaction_year = src.transaction_year ?? currentYear
    f.transaction_month = src.transaction_month ?? currentMonth + 1
    f.frequency = src.frequency ?? 'monthly'
    f.start = src.start ?? 'immediately'
    f.start_year = src.start_year
    f.start_month = src.start_month
    f.start_age = src.start_age
    f.end = src.end ?? 'never'
    f.end_year = src.end_year
    f.end_month = src.end_month
    f.end_age = src.end_age
    // Legacy migration: old change_over_time='match_inflation' folds into the
    // new toggle and the dropdown collapses to 'none'.
    const legacyInflation = src.change_over_time === 'match_inflation'
    f.inflation_adjusted = src.inflation_adjusted === true || legacyInflation
    f.change_over_time = legacyInflation ? 'none' : (src.change_over_time ?? 'none')
    f.change_percentage = src.change_percentage
    return f
  }

  let form = $state<FormState>(blankForm())
  // Controlled state for the Max-helper tooltip. Hover/focus events still
  // open/close it via bits-ui's onOpenChange. Click toggles it manually so
  // touch devices (no hover) can show *and* dismiss it.
  let maxTooltipOpen = $state(false)

  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(initial)
      maxTooltipOpen = false
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  // Plan-level inclusion of this transfer. `undefined` (default) means all
  // transfers are included; once the user toggles exclusion the array
  // materializes and tracks which transfers stay active.
  const isIncluded = $derived.by(() => {
    if (isNew) return true
    if (plan.included_transfer_ids === undefined) return true
    return plan.included_transfer_ids.includes(form.id)
  })

  let fromAssetItems = $derived(
    assetOptions.map((opt) => ({
      value: opt.id,
      label: opt.name,
      disabled: opt.id === form.to_asset_id,
    })),
  )
  let toAssetItems = $derived(
    assetOptions.map((opt) => ({
      value: opt.id,
      label: opt.name,
      disabled: opt.id === form.from_asset_id,
    })),
  )
  let scheduleItems: SelectFieldItem<TransferSchedule>[] = $derived([
    { value: 'one_time', label: $_('page.plan.scheduleOneTime') },
    { value: 'recurring', label: $_('page.plan.scheduleRecurring') },
  ])
  let frequencyItems = $derived(getFrequencyItems($_))
  let yearItems = $derived(years.map((y) => ({ value: y, label: y })))

  function projectTransfer(f: FormState): Transfer {
    if (f.schedule === 'one_time') {
      return {
        id: f.id,
        name: f.name,
        from_asset_id: f.from_asset_id,
        to_asset_id: f.to_asset_id,
        amount: f.transfer_all ? 0 : (f.amount ?? 0),
        ...(f.transfer_all ? { transfer_all: true } : {}),
        inflation_adjusted: f.inflation_adjusted ? true : undefined,
        schedule: 'one_time',
        transaction_year: f.transaction_year,
        transaction_month: f.transaction_month,
      }
    }
    return {
      id: f.id,
      name: f.name,
      from_asset_id: f.from_asset_id,
      to_asset_id: f.to_asset_id,
      amount: f.transfer_all ? 0 : (f.amount ?? 0),
      ...(f.transfer_all ? { transfer_all: true } : {}),
      inflation_adjusted: f.inflation_adjusted ? true : undefined,
      schedule: 'recurring',
      frequency: f.frequency,
      start: f.start,
      start_year: f.start === 'at_specific_date' ? f.start_year : undefined,
      start_month: f.start === 'at_specific_date' ? f.start_month : undefined,
      start_age: f.start === 'when_age_is' ? f.start_age : undefined,
      end: f.end,
      end_year: f.end === 'at_specific_date' ? f.end_year : undefined,
      end_month: f.end === 'at_specific_date' ? f.end_month : undefined,
      end_age: f.end === 'when_age_is' ? f.end_age : undefined,
      change_over_time: f.change_over_time,
      change_percentage:
        f.change_over_time === 'increase_yearly' || f.change_over_time === 'decrease_yearly'
          ? (f.change_percentage ?? 0)
          : undefined,
    }
  }

  function close() {
    onOpenChange(false)
  }

  function save() {
    const existing = plan.transfers ?? []
    const projected = projectTransfer(form)
    const idx = existing.findIndex((t) => t.id === form.id)
    const next =
      idx === -1 ? [...existing, projected] : existing.map((it, i) => (i === idx ? projected : it))
    // If the plan has an explicit transfer include list, append the new id so
    // the new transfer is visible by default (mirrors income/expense flow).
    const updates: Parameters<typeof plan.update>[0] = { transfers: next }
    if (idx === -1 && plan.included_transfer_ids !== undefined) {
      updates.included_transfer_ids = [...plan.included_transfer_ids, form.id]
    }
    plan.update(updates)
    close()
  }

  function duplicate() {
    const existing = plan.transfers ?? []
    const idx = existing.findIndex((t) => t.id === form.id)
    if (idx === -1) return
    const copy: Transfer = {
      ...existing[idx],
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
    }
    const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
    const updates: Parameters<typeof plan.update>[0] = { transfers: next }
    if (plan.included_transfer_ids !== undefined) {
      updates.included_transfer_ids = [...plan.included_transfer_ids, copy.id]
    }
    plan.update(updates)
    close()
  }

  function toggleExclude() {
    const allIds = (plan.transfers ?? []).map((t) => t.id)
    const seeded = plan.included_transfer_ids ?? allIds
    const nextIds = seeded.includes(form.id)
      ? seeded.filter((id) => id !== form.id)
      : [...seeded, form.id]
    plan.update({ included_transfer_ids: nextIds })
    close()
  }

  function remove() {
    if (!window.confirm($_('page.plan.deleteTransferConfirm'))) return
    const next = (plan.transfers ?? []).filter((t) => t.id !== form.id)
    plan.update({ transfers: next })
    close()
  }

  // Same-year ranges can't end before they start: months before the start
  // month are disabled in the end dropdown, and an end month that a later
  // start/year change turned invalid is cleared so the user picks again
  // (Save stays disabled until they do).
  const endMinMonth = $derived(
    form.start === 'at_specific_date' &&
      form.end === 'at_specific_date' &&
      form.start_year !== undefined &&
      form.start_year === form.end_year
      ? form.start_month
      : undefined,
  )
  $effect(() => {
    if (
      sameYearMonthsInverted(
        form.start,
        form.start_year,
        form.start_month,
        form.end,
        form.end_year,
        form.end_month,
      )
    ) {
      form.end_month = undefined
    }
  })

  const canSave = $derived(
    form.from_asset_id !== '' &&
      form.to_asset_id !== '' &&
      form.from_asset_id !== form.to_asset_id &&
      (form.transfer_all || (form.amount ?? 0) > 0) &&
      (form.schedule === 'one_time' ||
        (timingComplete(form.start, form.start_year, form.start_month, form.start_age) &&
          timingComplete(form.end, form.end_year, form.end_month, form.end_age) &&
          !sameYearMonthsInverted(
            form.start,
            form.start_year,
            form.start_month,
            form.end,
            form.end_year,
            form.end_month,
          ))),
  )
</script>

<ItemEditDialogShell
  bind:open
  {onOpenChange}
  name={form.name}
  onNameChange={(v) => (form.name = v)}
  {isNew}
  {isIncluded}
  renamable={false}
  newTitle={$_('page.plan.newTransfer')}
  saveDisabled={!canSave}
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  <!-- From + To -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-transferFromLabel">{$_('page.plan.transferFromLabel')}</Label>
      <SelectField
            id="{uid}-transferFromLabel"
        value={form.from_asset_id}
        items={fromAssetItems}
        placeholder={$_('page.plan.pickAsset')}
        onValueChange={(v) => {
          if (v) form.from_asset_id = v
        }}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-transferToLabel">{$_('page.plan.transferToLabel')}</Label>
      <SelectField
            id="{uid}-transferToLabel"
        value={form.to_asset_id}
        items={toAssetItems}
        placeholder={$_('page.plan.pickAsset')}
        onValueChange={(v) => {
          if (v) form.to_asset_id = v
        }}
      />
    </div>
  </div>

  <!-- Schedule + (one-time) Date  /  (recurring) Schedule alone -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-scheduleLabel">{$_('page.plan.scheduleLabel')}</Label>
      <SelectField
            id="{uid}-scheduleLabel"
        value={form.schedule}
        items={scheduleItems}
        onValueChange={(v) => {
          if (v) {
            form.schedule = v
            // `transfer_all` (Max) only applies to one-time transfers.
            if (form.schedule !== 'one_time') form.transfer_all = false
          }
        }}
      />
    </div>
    {#if form.schedule === 'one_time'}
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-transactionYear">{$_('page.plan.transactionDateLabel')}</Label>
        <div class="flex items-center gap-2">
          <SelectField
            id="{uid}-transactionYear"
            class="max-w-24"
            value={form.transaction_year !== undefined ? String(form.transaction_year) : ''}
            items={yearItems}
            onValueChange={(v) => {
              if (v) form.transaction_year = Number(v)
            }}
          />
          <SelectField
            value={form.transaction_month !== undefined ? String(form.transaction_month - 1) : ''}
            items={months}
            onValueChange={(v) => {
              if (v) form.transaction_month = Number(v) + 1
            }}
          />
        </div>
      </div>
    {:else}
      <!-- Recurring: Frequency sits in the right column of the Schedule row. -->
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-transferFrequencyLabel">{$_('page.plan.transferFrequencyLabel')}</Label>
        <SelectField
            id="{uid}-transferFrequencyLabel"
          value={form.frequency}
          items={frequencyItems}
          onValueChange={(v) => {
            if (v) form.frequency = v
          }}
        />
      </div>
    {/if}
  </div>

  <!-- Amount (+ Max toggle for one-time only) + Label -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-transferAmount">{$_('page.setup.common.amount')}</Label>
      <div class="flex items-center gap-2">
        <div class="flex-1">
          {#if form.transfer_all}
            <Input
            id="{uid}-transferAmount" value={$_('page.plan.transferMax')} readonly class="text-muted-foreground" />
          {:else}
            <SuffixedInput
              value={form.amount}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.amount = v)}
            />
          {/if}
        </div>
        {#if form.schedule === 'one_time'}
          <label class="flex shrink-0 cursor-pointer items-center gap-2">
            <Switch
              checked={form.transfer_all}
              onCheckedChange={(v) => (form.transfer_all = v === true)}
            />
            <span class="text-sm font-medium">{$_('page.plan.transferMax')}</span>
          </label>
          <Tooltip.Provider delayDuration={150}>
            <Tooltip.Root bind:open={maxTooltipOpen} disableCloseOnTriggerClick>
              <Tooltip.Trigger
                type="button"
                aria-label={$_('page.plan.transferMaxDescription')}
                onclick={() => (maxTooltipOpen = !maxTooltipOpen)}
                class="text-muted-foreground hover:text-foreground shrink-0"
              >
                <CircleHelp class="size-4" />
              </Tooltip.Trigger>
              <Tooltip.Content>
                {$_('page.plan.transferMaxDescription')}
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        {/if}
      </div>
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-transferName">{$_('page.plan.transferLabelLabel')}</Label>
      <Input
            id="{uid}-transferName"
        value={form.name}
        oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
      />
    </div>
  </div>

  {#if form.schedule === 'recurring'}
    <DateAgeSelector
      mode="start"
      value={form.start}
      year={form.start_year}
      month={form.start_month}
      age={form.start_age}
      {years}
      {months}
      birthDateSet={appStore.profile.birthDate !== undefined}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.start = v)}
      onYearChange={(v) => (form.start_year = v)}
      onMonthChange={(v) => (form.start_month = v)}
      onAgeChange={(v) => (form.start_age = v)}
    />

    <DateAgeSelector
      mode="end"
      value={form.end}
      year={form.end_year}
      month={form.end_month}
      age={form.end_age}
      {years}
      {months}
      minMonth={endMinMonth}
      birthDateSet={appStore.profile.birthDate !== undefined}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.end = v)}
      onYearChange={(v) => (form.end_year = v)}
      onMonthChange={(v) => (form.end_month = v)}
      onAgeChange={(v) => (form.end_age = v)}
    />

    <ChangeOverTimeSelector
      value={form.change_over_time}
      percentage={form.change_percentage}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.change_over_time = v)}
      onPercentageChange={(v) => (form.change_percentage = v)}
    />
  {/if}

  <InflationAdjustToggle
    checked={form.inflation_adjusted}
    onCheckedChange={(v) => (form.inflation_adjusted = v)}
  />
</ItemEditDialogShell>
