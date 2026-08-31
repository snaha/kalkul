<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import Percent from '@lucide/svelte/icons/percent'
  import Settings2 from '@lucide/svelte/icons/settings-2'
  import Trash2 from '@lucide/svelte/icons/trash-2'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import InvestmentFields from '$lib/components/investment-fields.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import TangibleAssetFields from '$lib/components/tangible-asset-fields.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import type {
    CashFlowEnd,
    CashFlowStart,
    CompoundingFrequency,
    EntryFeeType,
    ExitFeeType,
    Frequency,
    InterestType,
    ProfileInvestment,
    ProfileLiability,
    ProfileTangibleAsset,
    RemainingTermUnit,
    TangibleAssetStatus,
    ValueOverTime,
  } from '$lib/schemas'
  import {
    getCompoundingFrequencyItems,
    getFrequencyItems,
    getInterestTypeItems,
    getRemainingTermUnitItems,
  } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import { getMonthOptions, getYearOptions } from '$lib/utils'

  import ItemEditDialogShell from './item-edit-dialog-shell.svelte'
  import {
    PROFILE_LISTS,
    duplicateProfileItem,
    isIncludedInPlan,
    removeProfileItem,
    toggleIncludedInPlan,
    upsertProfileItem,
  } from './profile-lists'

  export type AssetKind = 'investment' | 'tangibleAsset' | 'liability'

  // Discriminated union: the kind determines which asset type `initial` may
  // carry, so a kind/initial mismatch fails the typecheck instead of seeding
  // the wrong form at runtime.
  export type AssetTarget =
    | { kind: 'investment'; initial?: ProfileInvestment }
    | { kind: 'tangibleAsset'; initial?: ProfileTangibleAsset }
    | { kind: 'liability'; initial?: ProfileLiability }

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

  const years = getYearOptions()

  let months = $derived(getMonthOptions($locale ?? undefined))

  function blankForm(): FormState {
    const counter =
      kind === 'investment'
        ? (appStore.profile.investments ?? []).length + 1
        : kind === 'tangibleAsset'
          ? (appStore.profile.tangible_assets ?? []).length + 1
          : (appStore.profile.liabilities ?? []).length + 1
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
    } else {
      const l = src.initial
      f.outstanding_balance = l.outstanding_balance > 0 ? l.outstanding_balance : undefined
      f.installment_frequency = l.installment_frequency
      f.annual_rate = l.annual_rate > 0 ? l.annual_rate : undefined
      f.installment_amount = l.installment_amount > 0 ? l.installment_amount : undefined
      f.remaining_term = l.remaining_term > 0 ? l.remaining_term : undefined
      f.remaining_term_unit = l.remaining_term_unit ?? 'years'
      f.interest_type = l.interest_type ?? 'compound'
      f.compounding_frequency = l.compounding_frequency
    }
    return f
  }

  let form = $state<FormState>(blankForm())
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
      } else if (target.kind === 'liability') {
        showAdvanced =
          target.initial?.interest_type !== undefined ||
          target.initial?.compounding_frequency !== undefined
      } else if (target.kind === 'investment') {
        // Auto-open when the investment already carries fees, so editing it
        // never hides values that drive the math.
        const inv = target.initial
        showAdvanced =
          inv?.ter !== undefined || inv?.entry_fee !== undefined || inv?.exit_fee !== undefined
      } else {
        showAdvanced = false
      }
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  const listConfig = $derived(PROFILE_LISTS[kind])

  const isIncluded = $derived(isNew ? true : isIncludedInPlan(listConfig, form.id, plan))

  let frequencyItems = $derived(getFrequencyItems($_))

  let interestTypeItems = $derived(getInterestTypeItems($_))

  let compoundingFrequencyItems = $derived(getCompoundingFrequencyItems($_))

  let remainingTermUnitItems = $derived(getRemainingTermUnitItems($_))

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
      // Same rule as projectLiability, scoped to the financing.
      interest_type:
        f.status === 'financed' && f.interest_type !== 'compound' ? f.interest_type : undefined,
      compounding_frequency: f.status === 'financed' ? f.compounding_frequency : undefined,
    }
  }

  function projectLiability(f: FormState): ProfileLiability {
    // interest_type collapses to undefined when 'compound' (matches the
    // calculation default); compounding_frequency is only stored once the
    // user picks one, so an untouched liability keeps compounding at its
    // installment frequency instead of silently switching to daily.
    return {
      id: f.id,
      name: f.name,
      outstanding_balance: f.outstanding_balance ?? 0,
      installment_frequency: f.installment_frequency,
      annual_rate: f.annual_rate ?? 0,
      installment_amount: f.installment_amount ?? 0,
      remaining_term: f.remaining_term ?? 0,
      remaining_term_unit: f.remaining_term_unit,
      interest_type: f.interest_type !== 'compound' ? f.interest_type : undefined,
      compounding_frequency: f.compounding_frequency,
    }
  }

  function close() {
    onOpenChange(false)
  }

  function save() {
    if (kind === 'investment') {
      upsertProfileItem(PROFILE_LISTS.investment, projectInvestment(form), plan)
    } else if (kind === 'tangibleAsset') {
      upsertProfileItem(PROFILE_LISTS.tangibleAsset, projectTangibleAsset(form), plan)
    } else {
      upsertProfileItem(PROFILE_LISTS.liability, projectLiability(form), plan)
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
        : kind === 'tangibleAsset'
          ? $_('page.plan.deleteTangibleAssetConfirm')
          : $_('page.plan.deleteLiabilityConfirm')
    if (!window.confirm(confirmMessage)) return
    removeProfileItem(listConfig, form.id)
    close()
  }
</script>

{#snippet interestAdvanced()}
  <!-- Show / Hide advanced options -->
  <button
    type="button"
    onclick={() => (showAdvanced = !showAdvanced)}
    class="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
  >
    <Settings2 class="size-4" />
    <span>
      {showAdvanced ? $_('page.plan.hideAdvancedOptions') : $_('page.plan.showAdvancedOptions')}
    </span>
  </button>

  {#if showAdvanced}
    <Separator />

    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Percent class="size-4" />
      <span class="text-xs font-medium uppercase tracking-wide">
        {$_('page.plan.interestSection')}
      </span>
    </div>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-interestType">{$_('page.plan.interestType')}</Label>
        <SelectField
          id="{uid}-interestType"
          value={form.interest_type}
          items={interestTypeItems}
          onValueChange={(v) => {
            if (v) form.interest_type = v
          }}
        />
      </div>
      {#if form.interest_type === 'compound'}
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-compoundingFrequency">{$_('page.plan.compoundingFrequency')}</Label>
          <SelectField
            id="{uid}-compoundingFrequency"
            value={form.compounding_frequency}
            items={compoundingFrequencyItems}
            placeholder={$_('page.plan.compoundingDefault')}
            onValueChange={(v) => {
              if (v) form.compounding_frequency = v
            }}
          />
        </div>
      {:else}
        <div class="flex-1"></div>
      {/if}
      <HelpTooltip text={$_('page.plan.interestDescription')} class="mb-2" />
    </div>
  {/if}
{/snippet}

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
  renamable={kind === 'liability'}
  toolbar={kind === 'liability'}
  badge={kind === 'tangibleAsset' && form.status === 'financed' && !isNew
    ? $_('page.setup.tangibleAssets.financed')
    : undefined}
  newTitle={kind === 'investment'
    ? $_('page.plan.addInvestmentTitle')
    : kind === 'tangibleAsset'
      ? $_('page.plan.addTangibleAssetTitle')
      : undefined}
  footer={kind === 'liability' ? undefined : assetFooter}
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
      {months}
      birthDateSet={appStore.profile.birth_date !== undefined}
      formatNumber={appStore.formatNumber}
    />
  {:else if kind === 'tangibleAsset'}
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
      {months}
      birthDateSet={appStore.profile.birth_date !== undefined}
      formatNumber={appStore.formatNumber}
      formatCurrency={appStore.formatCurrencyCode}
    />
  {:else}
    <!-- liability -->
    <div class="flex flex-col gap-2">
      <Label for="{uid}-outstandingBalance2"
        >{$_('page.setup.liabilities.outstandingBalance')}</Label
      >
      <SuffixedInput
        id="{uid}-outstandingBalance2"
        value={form.outstanding_balance}
        suffix={currencyLabel}
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => (form.outstanding_balance = v)}
      />
    </div>
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-installmentFrequency2"
          >{$_('page.setup.liabilities.installmentFrequency')}</Label
        >
        <SelectField
          id="{uid}-installmentFrequency2"
          value={form.installment_frequency}
          items={frequencyItems}
          onValueChange={(v) => {
            if (v) form.installment_frequency = v
          }}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-annualRate2">{$_('page.setup.liabilities.annualRate')}</Label>
        <SuffixedInput
          id="{uid}-annualRate2"
          value={form.annual_rate}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.annual_rate = v)}
        />
      </div>
    </div>
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-installmentAmount2"
          >{$_('page.setup.liabilities.installmentAmount')}</Label
        >
        <SuffixedInput
          id="{uid}-installmentAmount2"
          value={form.installment_amount}
          suffix={currencyLabel}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.installment_amount = v)}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-remainingTerm2">{$_('page.setup.liabilities.remainingTerm')}</Label>
        <div class="flex items-center gap-2">
          <SuffixedInput
            id="{uid}-remainingTerm2"
            value={form.remaining_term}
            formatNumber={appStore.formatNumber}
            class="w-24"
            onValueChange={(v) => (form.remaining_term = v)}
          />
          <SelectField
            id="{uid}-remainingTermUnit2"
            value={form.remaining_term_unit}
            items={remainingTermUnitItems}
            onValueChange={(v) => {
              if (v) form.remaining_term_unit = v
            }}
          />
        </div>
      </div>
    </div>

    {@render interestAdvanced()}
  {/if}
</ItemEditDialogShell>
