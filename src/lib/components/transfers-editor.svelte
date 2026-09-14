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
  import { planOwnedItems, sharedItems } from '$lib/plan-owned'
  import type { Frequency, Transfer as TransferData } from '$lib/schemas'
  import { getFrequencyItems, getFrequencyShortLabel } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import {
    type TransferFields,
    blankTransferFields,
    transferFromFields,
    transferToFields,
  } from '$lib/transfer-form'

  type TransferUI = TransferFields & { editing: boolean }

  const editor = createListEditor<TransferData, TransferUI>({
    // Financial data holds the shared transfers only. Those created in a plan
    // carry its id, stay hidden here and are carried through every save.
    load: () => sharedItems(appStore.profile.transfers),
    // The card renders From/To, Amount/Frequency and the inflation toggle
    // only; Start/End/Change belong to the plan dialog. Timing fields are still
    // carried on the UI item so a save here round-trips them untouched.
    toUI: (t) => ({ ...transferToFields(t), editing: false }),
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
    persist: (data) =>
      appStore.updateProfile({
        transfers: [...data, ...planOwnedItems(appStore.profile.transfers)],
      }),
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
