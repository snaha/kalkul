<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import Trash2 from '@lucide/svelte/icons/trash-2'

  import InvestmentFields from '$lib/components/investment-fields.svelte'
  import TangibleAssetFields from '$lib/components/tangible-asset-fields.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { itemsForPlan } from '$lib/plan-owned'
  import { planRangeOf, planYearOptions, timingWithinPlan } from '$lib/plan-range'
  import type {
    CashFlowEnd,
    CashFlowStart,
    CompoundingFrequency,
    EntryFeeType,
    ExitFeeType,
    Frequency,
    InterestType,
    ProfileInvestment,
    ProfileTangibleAsset,
    RemainingTermUnit,
    TangibleAssetStatus,
    ValueOverTime,
  } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import { getMonthOptions } from '$lib/utils'

  import ItemEditDialogShell from './item-edit-dialog-shell.svelte'
  import {
    PROFILE_LISTS,
    duplicateProfileItem,
    isIncludedInPlan,
    removeProfileItem,
    toggleIncludedInPlan,
    upsertProfileItem,
  } from './profile-lists'

  export type AssetKind = 'investment' | 'tangibleAsset'

  // Discriminated union: the kind determines which asset type `initial` may
  // carry, so a kind/initial mismatch fails the typecheck instead of seeding
  // the wrong form at runtime.
  export type AssetTarget =
    | { kind: 'investment'; initial?: ProfileInvestment }
    | { kind: 'tangibleAsset'; initial?: ProfileTangibleAsset }

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    target: AssetTarget
    plan: PortfolioStore
    /** Called with the copy's id after a duplicate, so the caller can open it. */
    onDuplicated?: (id: string) => void
  }

  const uid = $props.id()

  let { open = $bindable(), onOpenChange, target, plan, onDuplicated }: Props = $props()

  const kind = $derived(target.kind)
  const initial = $derived(target.initial)

  interface FormState {
    id: string
    name: string
    // Investment
    balance: number | undefined
    apy: number | undefined
    ter: number | undefined
    entry_fee: number | undefined
    entry_fee_type: EntryFeeType
    exit_fee: number | undefined
    exit_fee_type: ExitFeeType
    start: CashFlowStart
    start_year: number | undefined
    start_month: number | undefined
    start_age: number | undefined
    exit: CashFlowEnd
    exit_year: number | undefined
    exit_month: number | undefined
    exit_age: number | undefined
    // Tangible asset
    value: number | undefined
    status: TangibleAssetStatus
    purchase: CashFlowStart
    purchase_year: number | undefined
    purchase_month: number | undefined
    purchase_age: number | undefined
    sale: CashFlowEnd
    sale_year: number | undefined
    sale_month: number | undefined
    sale_age: number | undefined
    value_over_time: ValueOverTime
    value_rate: number | undefined
    property_tax_rate: number | undefined
    // Tangible asset (financed) + liability share these
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    remaining_term_unit: RemainingTermUnit
    // Advanced: liability, and the financing of a financed tangible asset.
    // The frequency is absent until the user picks one — the engine then
    // compounds at the installment frequency, and merely opening this dialog
    // must not switch the loan to another cadence.
    interest_type: InterestType
    compounding_frequency: CompoundingFrequency | undefined
  }

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  const range = $derived(planRangeOf(plan, appStore.profile.birthDate))
  const years = $derived(planYearOptions(range))

  let months = $derived(getMonthOptions($locale ?? undefined))

  function blankForm(): FormState {
    const counter =
      kind === 'investment'
        ? itemsForPlan(appStore.profile.investments, plan.id).length + 1
        : kind === 'tangibleAsset'
          ? itemsForPlan(appStore.profile.tangible_assets, plan.id).length + 1
          : itemsForPlan(appStore.profile.liabilities, plan.id).length + 1
    const defaultName =
      kind === 'investment'
        ? $_('page.setup.investments.defaultName', { values: { index: counter } })
        : kind === 'tangibleAsset'
          ? $_('page.setup.tangibleAssets.defaultName', { values: { index: counter } })
          : $_('page.setup.liabilities.defaultName', { values: { index: counter } })
    return {
      id: crypto.randomUUID(),
      name: defaultName,
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
      value: undefined,
      status: 'fully_owned',
      purchase: 'immediately',
      purchase_year: undefined,
      purchase_month: undefined,
      purchase_age: undefined,
      sale: 'never',
      sale_year: undefined,
      sale_month: undefined,
      sale_age: undefined,
      value_over_time: 'appreciate',
      value_rate: undefined,
      property_tax_rate: undefined,
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      remaining_term_unit: 'years',
      interest_type: 'compound',
      compounding_frequency: undefined,
    }
  }

  function seedForm(src: AssetTarget): FormState {
    const f = blankForm()
    if (!src.initial) return f
    f.id = src.initial.id
    f.name = src.initial.name
    if (src.kind === 'investment') {
      const inv = src.initial
      f.balance = inv.balance > 0 ? inv.balance : undefined
      f.apy = inv.apy > 0 ? inv.apy : undefined
      f.ter = inv.ter !== undefined && inv.ter > 0 ? inv.ter : undefined
      f.entry_fee = inv.entry_fee !== undefined && inv.entry_fee > 0 ? inv.entry_fee : undefined
      f.entry_fee_type = inv.entry_fee_type ?? 'ongoing'
      f.exit_fee = inv.exit_fee !== undefined && inv.exit_fee > 0 ? inv.exit_fee : undefined
      f.exit_fee_type = inv.exit_fee_type ?? 'percentage'
      f.start = inv.start ?? 'immediately'
      f.start_year = inv.start_year
      f.start_month = inv.start_month
      f.start_age = inv.start_age
      f.exit = inv.exit ?? 'never'
      f.exit_year = inv.exit_year
      f.exit_month = inv.exit_month
      f.exit_age = inv.exit_age
    } else if (src.kind === 'tangibleAsset') {
      const a = src.initial
      f.value = a.value > 0 ? a.value : undefined
      f.status = a.status
      f.outstanding_balance =
        a.outstanding_balance !== undefined && a.outstanding_balance > 0
          ? a.outstanding_balance
          : undefined
      f.installment_frequency = a.installment_frequency ?? 'monthly'
      f.annual_rate = a.annual_rate !== undefined && a.annual_rate > 0 ? a.annual_rate : undefined
      f.installment_amount =
        a.installment_amount !== undefined && a.installment_amount > 0
          ? a.installment_amount
          : undefined
      f.remaining_term =
        a.remaining_term !== undefined && a.remaining_term > 0 ? a.remaining_term : undefined
      f.remaining_term_unit = a.remaining_term_unit ?? 'years'
      f.interest_type = a.interest_type ?? 'compound'
      f.compounding_frequency = a.compounding_frequency
      f.purchase = a.purchase ?? 'immediately'
      f.purchase_year = a.purchase_year
      f.purchase_month = a.purchase_month
      f.purchase_age = a.purchase_age
      f.sale = a.sale ?? 'never'
      f.sale_year = a.sale_year
      f.sale_month = a.sale_month
      f.sale_age = a.sale_age
      f.value_over_time = a.value_over_time ?? 'appreciate'
      f.value_rate = a.value_rate
      f.property_tax_rate = a.property_tax_rate
    }
    return f
  }

  let form = $state<FormState>(blankForm())
  // Every planned date or age must fall inside the plan (year precision).
  const timingWithin = $derived(
    kind === 'investment'
      ? timingWithinPlan(range, form.start, form.start_year, form.start_age) &&
          timingWithinPlan(range, form.exit, form.exit_year, form.exit_age)
      : timingWithinPlan(range, form.purchase, form.purchase_year, form.purchase_age) &&
          timingWithinPlan(range, form.sale, form.sale_year, form.sale_age),
  )
  // "Show advanced options" disclosure for a liability and for the financing
  // of a financed tangible asset. Auto-expands when the item already carries
  // non-default interest settings so the user can see what's driving the math.
  let showAdvanced = $state(false)

  // Re-seed form whenever the dialog opens.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(target)
      if (target.kind === 'tangibleAsset') {
        const a = target.initial
        showAdvanced = a?.value_over_time !== undefined || a?.property_tax_rate !== undefined
      } else {
        // Auto-open when the investment already carries fees, so editing it
        // never hides values that drive the math.
        const inv = target.initial
        showAdvanced =
          inv?.ter !== undefined || inv?.entry_fee !== undefined || inv?.exit_fee !== undefined
      }
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  const listConfig = $derived(PROFILE_LISTS[kind])

  const isIncluded = $derived(isNew ? true : isIncludedInPlan(listConfig, form.id, plan))

  function projectInvestment(f: FormState): ProfileInvestment {
    // Persist only the fee fields that the user actually touched; default
    // values (0 / ongoing / percentage) collapse back to undefined so the
    // stored shape stays minimal and migrations are easier later.
    return {
      id: f.id,
      name: f.name,
      balance: f.balance ?? 0,
      apy: f.apy ?? 0,
      ter: f.ter && f.ter > 0 ? f.ter : undefined,
      entry_fee: f.entry_fee && f.entry_fee > 0 ? f.entry_fee : undefined,
      entry_fee_type:
        f.entry_fee && f.entry_fee > 0 && f.entry_fee_type !== 'ongoing'
          ? f.entry_fee_type
          : undefined,
      exit_fee: f.exit_fee && f.exit_fee > 0 ? f.exit_fee : undefined,
      exit_fee_type:
        f.exit_fee && f.exit_fee > 0 && f.exit_fee_type !== 'percentage'
          ? f.exit_fee_type
          : undefined,
      // Defaults collapse to undefined: no planned timing is the norm.
      start: f.start !== 'immediately' ? f.start : undefined,
      start_year: f.start !== 'immediately' ? f.start_year : undefined,
      start_month: f.start !== 'immediately' ? f.start_month : undefined,
      start_age: f.start !== 'immediately' ? f.start_age : undefined,
      exit: f.exit !== 'never' ? f.exit : undefined,
      exit_year: f.exit !== 'never' ? f.exit_year : undefined,
      exit_month: f.exit !== 'never' ? f.exit_month : undefined,
      exit_age: f.exit !== 'never' ? f.exit_age : undefined,
    }
  }

  function projectTangibleAsset(f: FormState): ProfileTangibleAsset {
    return {
      id: f.id,
      name: f.name,
      value: f.value ?? 0,
      status: f.status,
      outstanding_balance: f.status === 'financed' ? (f.outstanding_balance ?? 0) : undefined,
      installment_frequency: f.status === 'financed' ? f.installment_frequency : undefined,
      annual_rate: f.status === 'financed' ? (f.annual_rate ?? 0) : undefined,
      installment_amount: f.status === 'financed' ? (f.installment_amount ?? 0) : undefined,
      remaining_term: f.status === 'financed' ? (f.remaining_term ?? 0) : undefined,
      remaining_term_unit: f.status === 'financed' ? f.remaining_term_unit : undefined,
      // Defaults collapse to undefined: no planned timing is the norm.
      purchase: f.purchase !== 'immediately' ? f.purchase : undefined,
      purchase_year: f.purchase !== 'immediately' ? f.purchase_year : undefined,
      purchase_month: f.purchase !== 'immediately' ? f.purchase_month : undefined,
      purchase_age: f.purchase !== 'immediately' ? f.purchase_age : undefined,
      sale: f.sale !== 'never' ? f.sale : undefined,
      sale_year: f.sale !== 'never' ? f.sale_year : undefined,
      sale_month: f.sale !== 'never' ? f.sale_month : undefined,
      sale_age: f.sale !== 'never' ? f.sale_age : undefined,
      // The rate only means something once one is entered.
      value_over_time: f.value_rate ? f.value_over_time : undefined,
      value_rate: f.value_rate,
      property_tax_rate: f.property_tax_rate,
      // Same rule as a standalone liability, scoped to the financing.
      interest_type:
        f.status === 'financed' && f.interest_type !== 'compound' ? f.interest_type : undefined,
      compounding_frequency: f.status === 'financed' ? f.compounding_frequency : undefined,
    }
  }

  function close() {
    onOpenChange(false)
  }

  function save() {
    if (kind === 'investment') {
      upsertProfileItem(PROFILE_LISTS.investment, projectInvestment(form), plan)
    } else {
      upsertProfileItem(PROFILE_LISTS.tangibleAsset, projectTangibleAsset(form), plan)
    }
    close()
  }

  function duplicate() {
    // Duplicating copies the SAVED item; edits sitting in the form would be
    // silently lost, so ask before discarding them (issue #65).
    const hasChanges = JSON.stringify(form) !== JSON.stringify(seedForm(target))
    if (hasChanges && !window.confirm($_('page.plan.duplicateUnsavedConfirm'))) return
    const copyId = duplicateProfileItem(
      listConfig,
      form.id,
      (name) => $_('page.setup.common.copySuffix', { values: { name } }),
      plan,
    )
    close()
    if (copyId !== undefined) onDuplicated?.(copyId)
  }

  function toggleExclude() {
    toggleIncludedInPlan(listConfig, form.id, plan)
    close()
  }

  function remove() {
    const confirmMessage =
      kind === 'investment'
        ? $_('page.plan.deleteInvestmentConfirm')
        : $_('page.plan.deleteTangibleAssetConfirm')
    if (!window.confirm(confirmMessage)) return
    removeProfileItem(listConfig, form.id)
    close()
  }
</script>

{#snippet assetFooter()}
  <!-- Figma 1320-1330: primary + cancel on the left, and on the right the
       advanced switch when adding or the delete button when editing. -->
  <div class="flex flex-1 items-center gap-2">
    <Button onclick={save}>
      {isNew ? $_('page.plan.createItem') : $_('page.plan.saveChanges')}
    </Button>
    <Button variant="secondary" onclick={() => onOpenChange(false)}>
      {$_('page.plan.cancel')}
    </Button>
    <div class="flex flex-1 items-center justify-end gap-2">
      <label class="flex cursor-pointer items-center gap-2">
        <Switch checked={showAdvanced} onCheckedChange={(v) => (showAdvanced = v)} />
        <span class="text-sm">
          {showAdvanced ? $_('page.plan.hideAdvancedOptions') : $_('page.plan.showAdvancedOptions')}
        </span>
      </label>
      {#if !isNew}
        <Button
          variant="ghost"
          size="icon"
          class="text-destructive"
          onclick={remove}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      {/if}
    </div>
  </div>
{/snippet}

<ItemEditDialogShell
  bind:open
  {onOpenChange}
  name={form.name}
  onNameChange={(v) => (form.name = v)}
  {isNew}
  {isIncluded}
  renamable={false}
  toolbar={false}
  saveDisabled={!timingWithin}
  badge={kind === 'tangibleAsset' && form.status === 'financed' && !isNew
    ? $_('page.setup.tangibleAssets.financed')
    : undefined}
  newTitle={kind === 'investment'
    ? $_('page.plan.addInvestmentTitle')
    : $_('page.plan.addTangibleAssetTitle')}
  footer={assetFooter}
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  {#if kind === 'investment'}
    <div class="flex flex-col gap-2">
      <Label for="{uid}-investmentLabel">{$_('page.plan.investmentLabel')}</Label>
      <Input
        id="{uid}-investmentLabel"
        value={form.name}
        oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
      />
    </div>

    <InvestmentFields
      bind:item={form}
      idPrefix={uid}
      amountLabel={$_('page.plan.initialAmount')}
      {showAdvanced}
      showTiming
      {currencyLabel}
      {years}
      {range}
      {months}
      birthDateSet={appStore.profile.birth_date !== undefined}
      formatNumber={appStore.formatNumber}
    />
  {:else}
    <div class="flex flex-col gap-2">
      <Label for="{uid}-tangibleLabel">{$_('page.plan.investmentLabel')}</Label>
      <Input
        id="{uid}-tangibleLabel"
        value={form.name}
        oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
      />
    </div>

    <TangibleAssetFields
      bind:item={form}
      idPrefix={uid}
      {showAdvanced}
      showTiming
      {currencyLabel}
      {years}
      {range}
      {months}
      birthDateSet={appStore.profile.birth_date !== undefined}
      formatNumber={appStore.formatNumber}
      formatCurrency={appStore.formatCurrencyCode}
    />
  {/if}
</ItemEditDialogShell>
