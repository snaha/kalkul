<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import InflationAdjustToggle from '$lib/components/inflation-adjust-toggle.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { Frequency, Transfer as TransferData, TransferSchedule } from '$lib/schemas'
  import { getFrequencyItems, getFrequencyShortLabel } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'

  type TransferUI = {
    id: string
    name: string
    amount: number | undefined
    frequency: Frequency
    from_asset_id: string
    to_asset_id: string
    inflation_adjusted: boolean
    // Not editable here (the setup card has no scheduling controls, per its
    // Figma) but carried so editing a card cannot turn a one-time transfer
    // created in the plan dialog into a recurring one.
    schedule: TransferSchedule
    editing: boolean
  }

  const editor = createListEditor<TransferData, TransferUI>({
    load: () => appStore.profile.transfers,
    toUI: (t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount > 0 ? t.amount : undefined,
      frequency: t.frequency ?? 'monthly',
      from_asset_id: t.from_asset_id,
      to_asset_id: t.to_asset_id,
      inflation_adjusted: t.inflation_adjusted === true,
      schedule: t.schedule,
      editing: false,
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.transfers.defaultName', { values: { index } }),
      amount: undefined,
      frequency: 'monthly',
      // Cash is the overwhelmingly common source, and seeding it keeps a
      // named-but-unfinished card schema-valid (from !== to) so it survives
      // a remount instead of being rejected as a self-transfer.
      from_asset_id: 'cash',
      to_asset_id: '',
      // Default ON — mirrors the income/expense default so new transfers
      // keep their real value over time without the user having to flip it.
      inflation_adjusted: true,
      schedule: 'recurring',
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    // Continue/Done is only enabled once the transfer becomes meaningful: an
    // amount plus both endpoints chosen (and distinct — enforced by the card).
    hasValue: (t) =>
      (t.amount ?? 0) > 0 &&
      t.from_asset_id !== '' &&
      t.to_asset_id !== '' &&
      t.from_asset_id !== t.to_asset_id,
    // Spread the stored transfer first so everything this card does not show
    // — one-time transaction dates, transfer_all, custom start/end, change
    // over time — survives an edit here. Only the rendered fields override it.
    toStored: (t, prev) => ({
      schedule: 'recurring',
      start: 'immediately',
      end: 'never',
      change_over_time: 'none',
      ...prev,
      id: t.id,
      name: t.name,
      from_asset_id: t.from_asset_id,
      to_asset_id: t.to_asset_id,
      amount: t.amount ?? 0,
      // A one-time transfer has no frequency to set here.
      frequency: t.schedule === 'one_time' ? prev?.frequency : t.frequency,
      inflation_adjusted: t.inflation_adjusted ? true : undefined,
    }),
    persist: (data) => appStore.updateProfile({ transfers: data }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

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
          <!-- Amount and Frequency row -->
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
