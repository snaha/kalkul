<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import InvestmentFields from '$lib/components/investment-fields.svelte'
  import { Button } from '$lib/components/ui/button'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type {
    CashFlowEnd,
    CashFlowStart,
    EntryFeeType,
    ExitFeeType,
    ProfileInvestment,
  } from '$lib/schemas'
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
    // Not editable here (the setup card has no timing controls, per its
    // Figma) but carried so editing a card cannot wipe a plan's timing.
    start: CashFlowStart
    start_year: number | undefined
    start_month: number | undefined
    start_age: number | undefined
    exit: CashFlowEnd
    exit_year: number | undefined
    exit_month: number | undefined
    exit_age: number | undefined
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
      start: inv.start ?? 'immediately',
      start_year: inv.start_year,
      start_month: inv.start_month,
      start_age: inv.start_age,
      exit: inv.exit ?? 'never',
      exit_year: inv.exit_year,
      exit_month: inv.exit_month,
      exit_age: inv.exit_age,
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
      start: 'immediately',
      start_year: undefined,
      start_month: undefined,
      start_age: undefined,
      exit: 'never',
      exit_year: undefined,
      exit_month: undefined,
      exit_age: undefined,
      showAdvanced: false,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (i) => (i.balance ?? 0) > 0,
    // Spread the stored investment first so anything this card does not
    // render survives an edit here; only the rendered fields override it.
    toStored: (i, prev) => ({
      ...prev,
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
      // Defaults collapse to undefined so an untouched investment stays as it
      // was stored.
      start: i.start !== 'immediately' ? i.start : undefined,
      start_year: i.start_year,
      start_month: i.start_month,
      start_age: i.start_age,
      exit: i.exit !== 'never' ? i.exit : undefined,
      exit_year: i.exit_year,
      exit_month: i.exit_month,
      exit_age: i.exit_age,
    }),
    // has_investments belongs to the Get started checkbox, not to this list:
    // re-deriving it here unchecked the box (and dropped the step from the
    // flow) the moment a seeded card was collapsed without a value.
    persist: (data) => appStore.updateProfile({ investments: data }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function formatBalance(balance: number | undefined): string {
    if (balance === undefined || balance === 0) return ''
    return appStore.formatCurrencyCode(balance)
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as investment, i (investment.id)}
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
          <InvestmentFields
            bind:item={editor.items[i]}
            idPrefix={investment.id}
            amountLabel={$_('page.setup.investments.currentBalance')}
            showAdvanced={investment.showAdvanced}
            {currencyLabel}
            formatNumber={appStore.formatNumber}
          />
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
