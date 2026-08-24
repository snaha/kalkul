<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { EntryFeeType, ExitFeeType, ProfileInvestment } from '$lib/schemas'
  import { getEntryFeeTypeItems, getExitFeeTypeItems } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'

  interface InvestmentUI {
    id: string
    name: string
    balance: number | undefined
    apy: number | undefined
    ter: number | undefined
    entry_fee: number | undefined
    entry_fee_type: EntryFeeType
    exit_fee: number | undefined
    exit_fee_type: ExitFeeType
    // UI-only: whether the fee fields are revealed, toggled from the card menu.
    showAdvanced: boolean
    editing: boolean
  }

  // A stored value of 0 means "unset" for the fee fields, matching how the plan
  // asset dialog persists them.
  function positive(value: number | undefined): number | undefined {
    return value !== undefined && value > 0 ? value : undefined
  }

  const editor = createListEditor<ProfileInvestment, InvestmentUI>({
    load: () => appStore.profile.investments,
    toUI: (inv) => ({
      id: inv.id,
      name: inv.name,
      balance: inv.balance > 0 ? inv.balance : undefined,
      apy: inv.apy > 0 ? inv.apy : undefined,
      ter: positive(inv.ter),
      entry_fee: positive(inv.entry_fee),
      entry_fee_type: inv.entry_fee_type ?? 'ongoing',
      exit_fee: positive(inv.exit_fee),
      exit_fee_type: inv.exit_fee_type ?? 'percentage',
      // Reveal the fees when the investment already has some, so values set in
      // the plan dialog are not hidden here.
      showAdvanced:
        positive(inv.ter) !== undefined ||
        positive(inv.entry_fee) !== undefined ||
        positive(inv.exit_fee) !== undefined,
      editing: false,
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.investments.defaultName', { values: { index } }),
      balance: undefined,
      apy: undefined,
      ter: undefined,
      entry_fee: undefined,
      entry_fee_type: 'ongoing',
      exit_fee: undefined,
      exit_fee_type: 'percentage',
      showAdvanced: false,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (i) => (i.balance ?? 0) > 0,
    toStored: (i) => ({
      id: i.id,
      name: i.name,
      balance: i.balance ?? 0,
      apy: i.apy ?? 0,
      ter: positive(i.ter),
      entry_fee: positive(i.entry_fee),
      // Only store a type when its fee is set and the type is not the default.
      entry_fee_type:
        positive(i.entry_fee) !== undefined && i.entry_fee_type !== 'ongoing'
          ? i.entry_fee_type
          : undefined,
      exit_fee: positive(i.exit_fee),
      exit_fee_type:
        positive(i.exit_fee) !== undefined && i.exit_fee_type !== 'percentage'
          ? i.exit_fee_type
          : undefined,
    }),
    persist: (data) =>
      appStore.updateProfile({
        investments: data,
        has_investments: data.length > 0,
      }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let entryFeeTypeItems = $derived(getEntryFeeTypeItems($_))

  let exitFeeTypeItems = $derived(getExitFeeTypeItems($_))

  function formatBalance(balance: number | undefined): string {
    if (balance === undefined || balance === 0) return ''
    return appStore.formatCurrencyCode(balance)
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as investment (investment.id)}
    <div class="flex flex-col gap-1">
      <EditableItemCard
        item={investment}
        collapsedValue={formatBalance(investment.balance)}
        advancedChecked={investment.showAdvanced}
        onAdvancedChange={(checked) => {
          investment.showAdvanced = checked
        }}
        onToggleEditing={() => {
          investment.editing = !investment.editing
        }}
        onDuplicate={() => editor.duplicate(investment)}
        onDelete={() => editor.remove(investment)}
      >
        {#snippet expandedContent()}
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="currentBalance-{investment.id}"
                >{$_('page.setup.investments.currentBalance')}</Label
              >
              <SuffixedInput
                id="currentBalance-{investment.id}"
                value={investment.balance}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  investment.balance = v
                }}
              />
            </div>
            <div class="flex w-32 flex-col gap-2">
              <Label for="apy-{investment.id}">{$_('page.setup.investments.apy')}</Label>
              <SuffixedInput
                id="apy-{investment.id}"
                value={investment.apy}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  investment.apy = v
                }}
              />
            </div>
          </div>

          {#if investment.showAdvanced}
            <Separator />

            <!-- Total expense ratio -->
            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="ter-{investment.id}">{$_('page.plan.totalExpenseRatio')}</Label>
                <SuffixedInput
                  id="ter-{investment.id}"
                  value={investment.ter}
                  suffix="%"
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    investment.ter = v
                  }}
                />
              </div>
              <HelpTooltip text={$_('page.plan.totalExpenseRatioDescription')} class="mb-2" />
            </div>

            <!-- Entry fee + payment type -->
            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="entryFee-{investment.id}">{$_('page.plan.entryFee')}</Label>
                <SuffixedInput
                  id="entryFee-{investment.id}"
                  value={investment.entry_fee}
                  suffix="%"
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    investment.entry_fee = v
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label for="entryFeeType-{investment.id}">
                  {$_('page.plan.entryFeePaymentType')}
                </Label>
                <SelectField
                  id="entryFeeType-{investment.id}"
                  value={investment.entry_fee_type}
                  items={entryFeeTypeItems}
                  onValueChange={(v) => {
                    if (v) investment.entry_fee_type = v
                  }}
                />
              </div>
              <HelpTooltip text={$_('page.plan.entryFeeDescription')} class="mb-2" />
            </div>

            <!-- Exit fee type + value -->
            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="exitFeeType-{investment.id}">{$_('page.plan.exitFee')}</Label>
                <SelectField
                  id="exitFeeType-{investment.id}"
                  value={investment.exit_fee_type}
                  items={exitFeeTypeItems}
                  onValueChange={(v) => {
                    if (v) investment.exit_fee_type = v
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <SuffixedInput
                  value={investment.exit_fee}
                  aria-label={$_('page.plan.exitFee')}
                  suffix={investment.exit_fee_type === 'fixed' ? currencyLabel : '%'}
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    investment.exit_fee = v
                  }}
                />
              </div>
              <HelpTooltip text={$_('page.plan.exitFeeDescription')} class="mb-2" />
            </div>
          {/if}
        {/snippet}
      </EditableItemCard>
      <EditorItemErrors messages={editor.errors[investment.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.investments.addInvestment')}
    </Button>
  </div>
</div>
