<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import { CircleHelp, CopyPlus, Eye, EyeOff, Trash2, X } from '@lucide/svelte'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Switch } from '$lib/components/ui/switch'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import type {
    CashFlowEnd,
    CashFlowStart,
    ChangeOverTime,
    Frequency,
    Transfer,
    TransferSchedule,
  } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import { calculateAge, getMonthOptions, getYearOptions } from '$lib/utils'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial: Transfer | undefined
    plan: PortfolioStore
  }

  let { open = $bindable(), onOpenChange, initial, plan }: Props = $props()

  interface FormState {
    id: string
    name: string
    from_asset_id: string
    to_asset_id: string
    amount: number | undefined
    transfer_all: boolean
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
  let currentAge = $derived(
    Number(calculateAge(appStore.profile.birthDate, currentYear, currentMonth)) || undefined,
  )
  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  // Build the From/To asset list from the profile, filtered by plan inclusion
  // (mirrors `filterById` in plan-projection.ts so the dropdowns and the
  // projection see the same asset set).
  function included<T extends { id: string }>(
    items: T[] | undefined,
    includedIds: string[] | undefined,
  ): T[] {
    if (!items) return []
    if (!includedIds) return items
    const set = new Set(includedIds)
    return items.filter((i) => set.has(i.id))
  }

  // Transfers can only move between cash and investments. Tangible assets and
  // liabilities are intentionally excluded — selling/buying a house is more
  // naturally modelled as a one-off expense/income.
  const assetOptions = $derived<{ id: string; name: string }[]>([
    ...(plan.include_cash !== false && appStore.profile.cash_amount
      ? [{ id: 'cash', name: $_('page.plan.cashItem') }]
      : []),
    ...included(appStore.profile.investments, plan.included_investment_ids).map((inv) => ({
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
      schedule: 'one_time',
      transaction_year: currentYear,
      transaction_month: currentMonth + 1,
      frequency: 'monthly',
      start: 'immediately',
      start_year: currentYear,
      start_month: currentMonth + 1,
      start_age: currentAge,
      end: 'never',
      end_year: currentYear,
      end_month: currentMonth + 1,
      end_age: currentAge,
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
    f.start_year = src.start_year ?? currentYear
    f.start_month = src.start_month ?? currentMonth + 1
    f.start_age = src.start_age ?? currentAge
    f.end = src.end ?? 'never'
    f.end_year = src.end_year ?? currentYear
    f.end_month = src.end_month ?? currentMonth + 1
    f.end_age = src.end_age ?? currentAge
    f.change_over_time = src.change_over_time ?? 'none'
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

  function assetName(id: string): string {
    return assetOptions.find((a) => a.id === id)?.name ?? ''
  }

  function frequencyLabel(f: Frequency): string {
    if (f === 'yearly') return $_('page.setup.common.yearly')
    if (f === 'weekly') return $_('page.setup.common.weekly')
    return $_('page.setup.common.monthly')
  }

  function projectTransfer(f: FormState): Transfer {
    if (f.schedule === 'one_time') {
      return {
        id: f.id,
        name: f.name,
        from_asset_id: f.from_asset_id,
        to_asset_id: f.to_asset_id,
        amount: f.transfer_all ? 0 : (f.amount ?? 0),
        ...(f.transfer_all ? { transfer_all: true } : {}),
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

  const canSave = $derived(
    form.from_asset_id !== '' &&
      form.to_asset_id !== '' &&
      form.from_asset_id !== form.to_asset_id &&
      (form.transfer_all || (form.amount ?? 0) > 0),
  )
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
      <Dialog.Title class="flex-1 truncate text-lg font-semibold">
        {isNew ? $_('page.plan.newTransfer') : form.name}
      </Dialog.Title>

      {#if !isNew}
        <Button
          variant="ghost"
          size="icon"
          onclick={duplicate}
          aria-label={$_('page.plan.duplicateItem')}
        >
          <CopyPlus class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={toggleExclude}
          aria-label={isIncluded ? $_('page.plan.excludeFromPlan') : $_('page.plan.includeInPlan')}
        >
          {#if isIncluded}
            <Eye class="size-4" />
          {:else}
            <EyeOff class="size-4 text-destructive" />
          {/if}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={remove}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
      <!-- From + To -->
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label>{$_('page.plan.transferFromLabel')}</Label>
          <Select.Root
            type="single"
            value={form.from_asset_id}
            onValueChange={(v) => {
              if (v) form.from_asset_id = v
            }}
          >
            <Select.Trigger class="w-full">
              {form.from_asset_id ? assetName(form.from_asset_id) : $_('page.plan.pickAsset')}
            </Select.Trigger>
            <Select.Content>
              {#each assetOptions as opt (opt.id)}
                <Select.Item value={opt.id} disabled={opt.id === form.to_asset_id}>
                  {opt.name}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <Label>{$_('page.plan.transferToLabel')}</Label>
          <Select.Root
            type="single"
            value={form.to_asset_id}
            onValueChange={(v) => {
              if (v) form.to_asset_id = v
            }}
          >
            <Select.Trigger class="w-full">
              {form.to_asset_id ? assetName(form.to_asset_id) : $_('page.plan.pickAsset')}
            </Select.Trigger>
            <Select.Content>
              {#each assetOptions as opt (opt.id)}
                <Select.Item value={opt.id} disabled={opt.id === form.from_asset_id}>
                  {opt.name}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <!-- Schedule + (one-time) Date  /  (recurring) Schedule alone -->
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label>{$_('page.plan.scheduleLabel')}</Label>
          <Select.Root
            type="single"
            value={form.schedule}
            onValueChange={(v) => {
              if (v) {
                form.schedule = v as TransferSchedule
                // `transfer_all` (Max) only applies to one-time transfers.
                if (form.schedule !== 'one_time') form.transfer_all = false
              }
            }}
          >
            <Select.Trigger class="w-full">
              {form.schedule === 'recurring'
                ? $_('page.plan.scheduleRecurring')
                : $_('page.plan.scheduleOneTime')}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="one_time">{$_('page.plan.scheduleOneTime')}</Select.Item>
              <Select.Item value="recurring">{$_('page.plan.scheduleRecurring')}</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
        {#if form.schedule === 'one_time'}
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.plan.transactionDateLabel')}</Label>
            <div class="flex items-center gap-2">
              <Select.Root
                type="single"
                value={form.transaction_year !== undefined ? String(form.transaction_year) : ''}
                onValueChange={(v) => {
                  if (v) form.transaction_year = Number(v)
                }}
              >
                <Select.Trigger class="w-full max-w-24">
                  {form.transaction_year ?? ''}
                </Select.Trigger>
                <Select.Content>
                  {#each years as y (y)}
                    <Select.Item value={y}>{y}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              <Select.Root
                type="single"
                value={form.transaction_month !== undefined ? String(form.transaction_month) : ''}
                onValueChange={(v) => {
                  if (v) form.transaction_month = Number(v)
                }}
              >
                <Select.Trigger class="w-full">
                  {form.transaction_month !== undefined
                    ? (months[form.transaction_month - 1]?.label ?? '')
                    : ''}
                </Select.Trigger>
                <Select.Content>
                  {#each months as m (m.value)}
                    <Select.Item value={m.value}>{m.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        {:else}
          <!-- Recurring: Frequency sits in the right column of the Schedule row. -->
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.plan.transferFrequencyLabel')}</Label>
            <Select.Root
              type="single"
              value={form.frequency}
              onValueChange={(v) => {
                if (v) form.frequency = v as Frequency
              }}
            >
              <Select.Trigger class="w-full">
                {frequencyLabel(form.frequency)}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="monthly">{$_('page.setup.common.monthly')}</Select.Item>
                <Select.Item value="yearly">{$_('page.setup.common.yearly')}</Select.Item>
                <Select.Item value="weekly">{$_('page.setup.common.weekly')}</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        {/if}
      </div>

      <!-- Amount (+ Max toggle for one-time only) + Label -->
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label>{$_('page.setup.common.amount')}</Label>
          <div class="flex items-center gap-2">
            <div class="flex-1">
              {#if form.transfer_all}
                <Input value={$_('page.plan.transferMax')} readonly class="text-muted-foreground" />
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
          <Label>{$_('page.plan.transferLabelLabel')}</Label>
          <Input
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
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.start = v as CashFlowStart)}
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
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.end = v as CashFlowEnd)}
          onYearChange={(v) => (form.end_year = v)}
          onMonthChange={(v) => (form.end_month = v)}
          onAgeChange={(v) => (form.end_age = v)}
        />

        <ChangeOverTimeSelector
          value={form.change_over_time}
          percentage={form.change_percentage}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.change_over_time = v as ChangeOverTime)}
          onPercentageChange={(v) => (form.change_percentage = v)}
        />
      {/if}
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button onclick={save} disabled={!canSave}>{$_('page.plan.saveChanges')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
