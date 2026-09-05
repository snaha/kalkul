<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _, locale } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import ChangeOverTimeSelector from '$lib/components/change-over-time-selector.svelte'
  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { Frequency, Transfer as TransferData } from '$lib/schemas'
  import { getFrequencyItems, getFrequencyShortLabel } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import {
    type TransferFields,
    blankTransferFields,
    transferFromFields,
    transferToFields,
  } from '$lib/transfer-form'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  type TransferUI = TransferFields & {
    showAdvanced: boolean
    editing: boolean
  }

  // The advanced section opens by itself when the stored transfer already
  // uses something it controls, so those settings are never hidden.
  function usesAdvanced(t: TransferData): boolean {
    return (
      (t.start !== undefined && t.start !== 'immediately' && t.start !== 'now') ||
      (t.end !== undefined && t.end !== 'never') ||
      (t.change_over_time !== undefined && t.change_over_time !== 'none')
    )
  }

  const editor = createListEditor<TransferData, TransferUI>({
    load: () => appStore.profile.transfers,
    toUI: (t) => ({ ...transferToFields(t), showAdvanced: usesAdvanced(t), editing: false }),
    makeBlank: (index) => ({
      ...blankTransferFields(
        crypto.randomUUID(),
        $_('page.setup.transfers.defaultName', { values: { index } }),
      ),
      // Cash is the overwhelmingly common source, and seeding it keeps a
      // named-but-unfinished card schema-valid (from !== to) so it survives
      // a remount instead of being rejected as a self-transfer.
      from_asset_id: 'cash',
      // Financial data holds recurring transfers only; one-time transfers are
      // created in the plan dialog.
      schedule: 'recurring',
      showAdvanced: false,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    // Continue/Done is only enabled once the transfer becomes meaningful: an
    // amount plus both endpoints chosen (and distinct — enforced by the card).
    hasValue: (t) =>
      (t.transfer_all || (t.amount ?? 0) > 0) &&
      t.from_asset_id !== '' &&
      t.to_asset_id !== '' &&
      t.from_asset_id !== t.to_asset_id,
    toStored: (t) => transferFromFields(t),
    persist: (data) => appStore.updateProfile({ transfers: data }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)
  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))

  // From/To dropdown options: cash plus every investment on the profile.
  // Transfers can only move between cash and investments — tangible assets
  // and liabilities are intentionally excluded (selling/buying a house is
  // more naturally modelled as a one-off expense/income), matching the plan's
  // transfer dialog. The mutually-exclusive endpoints are enforced per card by
  // disabling the option already chosen in the sibling dropdown.
  const assetOptions = $derived<{ id: string; name: string }[]>([
    { id: 'cash', name: $_('page.plan.cashItem') },
    ...(appStore.profile.investments ?? []).map((inv) => ({ id: inv.id, name: inv.name })),
  ])

  const frequencyItems: SelectFieldItem<Frequency>[] = $derived(getFrequencyItems($_))

  function collapsedValue(transfer: TransferUI): string | undefined {
    if (!transfer.amount) return undefined
    const amount = appStore.formatCurrencyCode(transfer.amount)
    if (transfer.schedule === 'one_time') return amount
    return `${amount} / ${getFrequencyShortLabel($_, transfer.frequency)}`
  }

  // Same-year ranges can't end before they start: disable the months before
  // the start month in the end dropdown. Schema validation still reports an
  // inverted pair through EditorItemErrors if one slips through.
  function endMinMonth(t: TransferUI): number | undefined {
    return t.start === 'at_specific_date' &&
      t.end === 'at_specific_date' &&
      t.start_year !== undefined &&
      t.start_year === t.end_year
      ? t.start_month
      : undefined
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as transfer (transfer.id)}
    {@const fromItems = assetOptions.map((opt) => ({
      value: opt.id,
      label: opt.name,
      disabled: opt.id === transfer.to_asset_id,
    }))}
    {@const toItems = assetOptions.map((opt) => ({
      value: opt.id,
      label: opt.name,
      disabled: opt.id === transfer.from_asset_id,
    }))}
    <div class="flex flex-col gap-1">
      <EditableItemCard
        item={transfer}
        collapsedValue={collapsedValue(transfer)}
        onToggleEditing={() => {
          transfer.editing = !transfer.editing
        }}
        onDuplicate={() => editor.duplicate(transfer)}
        onDelete={() => editor.remove(transfer)}
      >
        {#snippet expandedContent()}
          <!-- Amount and (recurring) Frequency row -->
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="amount-{transfer.id}">{$_('page.setup.transfers.amount')}</Label>
              <SuffixedInput
                id="amount-{transfer.id}"
                value={transfer.amount}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  transfer.amount = v
                }}
              />
            </div>
            {#if transfer.schedule === 'recurring'}
              <div class="flex flex-1 flex-col gap-2">
                <Label for="frequency-{transfer.id}">{$_('page.setup.transfers.frequency')}</Label>
                <SelectField
                  id="frequency-{transfer.id}"
                  value={transfer.frequency}
                  items={frequencyItems}
                  onValueChange={(v) => {
                    if (v) transfer.frequency = v
                  }}
                />
              </div>
            {:else}
              <div class="flex-1"></div>
            {/if}
          </div>

          <!-- From / To row -->
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="from-{transfer.id}">{$_('page.setup.transfers.from')}</Label>
              <SelectField
                id="from-{transfer.id}"
                value={transfer.from_asset_id}
                items={fromItems}
                onValueChange={(v) => {
                  if (v) transfer.from_asset_id = v
                }}
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label for="to-{transfer.id}">{$_('page.setup.transfers.to')}</Label>
              <SelectField
                id="to-{transfer.id}"
                value={transfer.to_asset_id}
                items={toItems}
                onValueChange={(v) => {
                  if (v) transfer.to_asset_id = v
                }}
              />
            </div>
          </div>

          <InflationAdjustToggle
            checked={transfer.inflation_adjusted}
            onCheckedChange={(v) => {
              transfer.inflation_adjusted = v
            }}
          />

          <!-- Advanced options (recurring only — a one-time transfer created in
               the plan dialog has no schedule fields to edit here) -->
          {#if transfer.schedule === 'recurring'}
            <label class="flex cursor-pointer items-center gap-2">
              <Switch
                checked={transfer.showAdvanced}
                onCheckedChange={(v) => {
                  transfer.showAdvanced = v === true
                }}
              />
              <span class="text-sm font-medium">{$_('page.setup.common.advancedOptions')}</span>
            </label>

            {#if transfer.showAdvanced}
              <Separator />

              <DateAgeSelector
                mode="start"
                value={transfer.start}
                year={transfer.start_year}
                month={transfer.start_month}
                age={transfer.start_age}
                {years}
                {months}
                birthDateSet={appStore.profile.birthDate !== undefined}
                description={$_('page.plan.transferStartDescription')}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  transfer.start = v
                }}
                onYearChange={(v) => {
                  transfer.start_year = v
                }}
                onMonthChange={(v) => {
                  transfer.start_month = v
                }}
                onAgeChange={(v) => {
                  transfer.start_age = v
                }}
              />

              <DateAgeSelector
                mode="end"
                value={transfer.end}
                year={transfer.end_year}
                month={transfer.end_month}
                age={transfer.end_age}
                {years}
                {months}
                minMonth={endMinMonth(transfer)}
                birthDateSet={appStore.profile.birthDate !== undefined}
                neverLabel={$_('page.plan.transferEndNever')}
                description={$_('page.plan.transferEndDescription')}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  transfer.end = v
                }}
                onYearChange={(v) => {
                  transfer.end_year = v
                }}
                onMonthChange={(v) => {
                  transfer.end_month = v
                }}
                onAgeChange={(v) => {
                  transfer.end_age = v
                }}
              />

              <ChangeOverTimeSelector
                value={transfer.change_over_time}
                percentage={transfer.change_percentage}
                noneLabel={$_('page.plan.transferChangeNone')}
                changeDescription={$_('page.plan.transferChangeDescription')}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  transfer.change_over_time = v
                }}
                onPercentageChange={(v) => {
                  transfer.change_percentage = v
                }}
              />
            {/if}
          {/if}
        {/snippet}
      </EditableItemCard>
      <EditorItemErrors messages={editor.errors[transfer.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.transfers.addTransfer')}
    </Button>
  </div>
</div>
