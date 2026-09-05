<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import CircleHelp from '@lucide/svelte/icons/circle-help'
  import TrendingUp from '@lucide/svelte/icons/trending-up'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import { filterById, summarizeTransfer } from '$lib/plan-projection'
  import { sameYearMonthsInverted, timingComplete } from '$lib/schemas'
  import type { Transfer, TransferSchedule } from '$lib/schemas'
  import { getFrequencyItems } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import {
    type TransferFields,
    blankTransferFields,
    transferFromFields,
    transferToFields,
  } from '$lib/transfer-form'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  import ItemEditDialogShell from './item-edit-dialog-shell.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial: Transfer | undefined
    plan: PortfolioStore
    /** Called with the copy's id after a duplicate, so the caller can open it. */
    onDuplicated?: (id: string) => void
  }

  const uid = $props.id()

  let { open = $bindable(), onOpenChange, initial, plan, onDuplicated }: Props = $props()

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

  function blankForm(): TransferFields {
    const counter = (appStore.profile.transfers ?? []).length + 1
    return blankTransferFields(
      crypto.randomUUID(),
      $_('page.plan.defaultTransferName', { values: { index: counter } }),
    )
  }

  function seedForm(src: Transfer | undefined): TransferFields {
    return src ? transferToFields(src) : blankForm()
  }

  let form = $state<TransferFields>(blankForm())
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

  function close() {
    onOpenChange(false)
  }

  function save() {
    const existing = appStore.profile.transfers ?? []
    const projected = transferFromFields(form)
    const idx = existing.findIndex((t) => t.id === form.id)
    const next =
      idx === -1 ? [...existing, projected] : existing.map((it, i) => (i === idx ? projected : it))
    // Save the transfer first: updateProfile validates, so referencing the id
    // from the plan before it lands could leave a dangling include entry.
    appStore.updateProfile({ transfers: next })
    // If the plan has an explicit transfer include list, append the new id so
    // the new transfer is visible by default (mirrors income/expense flow).
    if (idx === -1 && plan.included_transfer_ids !== undefined) {
      plan.update({ included_transfer_ids: [...plan.included_transfer_ids, form.id] })
    }
    close()
  }

  function duplicate() {
    // Duplicating copies the SAVED item; edits sitting in the form would be
    // silently lost, so ask before discarding them (issue #65).
    const hasChanges = JSON.stringify(form) !== JSON.stringify(seedForm(initial))
    if (hasChanges && !window.confirm($_('page.plan.duplicateUnsavedConfirm'))) return
    const existing = appStore.profile.transfers ?? []
    const idx = existing.findIndex((t) => t.id === form.id)
    if (idx === -1) return
    const copy: Transfer = {
      ...existing[idx],
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
    }
    const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
    appStore.updateProfile({ transfers: next })
    if (plan.included_transfer_ids !== undefined) {
      plan.update({ included_transfer_ids: [...plan.included_transfer_ids, copy.id] })
    }
    close()
    onDuplicated?.(copy.id)
  }

  function toggleExclude() {
    const allIds = (appStore.profile.transfers ?? []).map((t) => t.id)
    const seeded = plan.included_transfer_ids ?? allIds
    const nextIds = seeded.includes(form.id)
      ? seeded.filter((id) => id !== form.id)
      : [...seeded, form.id]
    plan.update({ included_transfer_ids: nextIds })
    close()
  }

  function remove() {
    if (!window.confirm($_('page.plan.deleteTransferConfirm'))) return
    const next = (appStore.profile.transfers ?? []).filter((t) => t.id !== form.id)
    appStore.updateProfile({ transfers: next })
    // Drop the id from the plan's include list too, so it can't dangle.
    if (plan.included_transfer_ids?.includes(form.id)) {
      plan.update({
        included_transfer_ids: plan.included_transfer_ids.filter((id) => id !== form.id),
      })
    }
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

  // Preview of what the transfer moves over the plan (Figma frames 1340-1345).
  // A one-time transfer without inflation has nothing to add beyond the
  // amount itself, so the box is hidden for it; "Max" has no fixed amount.
  const summary = $derived.by(() => {
    if (!canSave || form.transfer_all) return undefined
    if (form.schedule === 'one_time' && !form.inflation_adjusted) return undefined
    return summarizeTransfer(
      transferFromFields(form),
      plan,
      appStore.profile.birthDate?.getFullYear(),
    )
  })
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
  saveLabel={isNew ? $_('page.plan.createItem') : undefined}
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  <!-- Label -->
  <div class="flex flex-col gap-2">
    <Label for="{uid}-transferName">{$_('page.plan.transferLabelLabel')}</Label>
    <Input
      id="{uid}-transferName"
      value={form.name}
      oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
    />
  </div>

  <!-- Type + (one-time) Date  /  (recurring) Frequency -->
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
            aria-label={$_('page.setup.aboutYou.selectYear')}
            value={form.transaction_year !== undefined ? String(form.transaction_year) : ''}
            items={yearItems}
            onValueChange={(v) => {
              if (v) form.transaction_year = Number(v)
            }}
          />
          <SelectField
            aria-label={$_('page.setup.aboutYou.selectMonth')}
            value={form.transaction_month !== undefined ? String(form.transaction_month - 1) : ''}
            items={months}
            onValueChange={(v) => {
              if (v) form.transaction_month = Number(v) + 1
            }}
          />
        </div>
      </div>
    {:else}
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

  <!-- Amount (+ Max toggle for one-time only) + Adjust for inflation -->
  <!-- The Max switch is not in the Figma frames; kept as an existing feature. -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-transferAmount">{$_('page.setup.common.amount')}</Label>
      <div class="flex items-center gap-2">
        <div class="flex-1">
          {#if form.transfer_all}
            <Input
              id="{uid}-transferAmount"
              value={$_('page.plan.transferMax')}
              readonly
              class="text-muted-foreground"
            />
          {:else}
            <SuffixedInput
              id="{uid}-transferAmount"
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
    <div class="flex h-8 flex-1 items-center">
      <InflationAdjustToggle
        checked={form.inflation_adjusted}
        onCheckedChange={(v) => (form.inflation_adjusted = v)}
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
      description={$_('page.plan.transferStartDescription')}
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
      neverLabel={$_('page.plan.transferEndNever')}
      description={$_('page.plan.transferEndDescription')}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.end = v)}
      onYearChange={(v) => (form.end_year = v)}
      onMonthChange={(v) => (form.end_month = v)}
      onAgeChange={(v) => (form.end_age = v)}
    />

    <ChangeOverTimeSelector
      value={form.change_over_time}
      percentage={form.change_percentage}
      noneLabel={$_('page.plan.transferChangeNone')}
      changeDescription={$_('page.plan.transferChangeDescription')}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => (form.change_over_time = v)}
      onPercentageChange={(v) => (form.change_percentage = v)}
    />
  {/if}

  {#if summary}
    <div class="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      {#if form.schedule === 'recurring'}
        <span>
          {$_('page.plan.transferOccurrences', { values: { count: summary.occurrences } })}
        </span>
      {/if}
      {#if !form.inflation_adjusted}
        <span>
          {$_('page.plan.transferTotal', {
            values: { total: appStore.formatCurrencyCode(summary.nominalTotal) },
          })}
        </span>
      {:else}
        <span class="flex items-center gap-2">
          <TrendingUp class="size-4 shrink-0" />
          {#if form.schedule === 'one_time'}
            {$_('page.plan.transferNominalValue', {
              values: {
                nominal: appStore.formatCurrencyCode(summary.nominalTotal),
                real: appStore.formatCurrencyCode(summary.realTotal),
              },
            })}
          {:else}
            {$_('page.plan.transferNominalTotal', {
              values: {
                nominal: appStore.formatCurrencyCode(summary.nominalTotal),
                real: appStore.formatCurrencyCode(summary.realTotal),
              },
            })}
          {/if}
        </span>
      {/if}
    </div>
  {/if}
</ItemEditDialogShell>
