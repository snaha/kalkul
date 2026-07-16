<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Percent from '@lucide/svelte/icons/percent'
  import Receipt from '@lucide/svelte/icons/receipt'
  import Settings2 from '@lucide/svelte/icons/settings-2'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SelectField, { type SelectFieldItem } from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import type {
    CompoundingFrequency,
    EntryFeeType,
    ExitFeeType,
    Frequency,
    InterestType,
    ProfileInvestment,
    ProfileLiability,
    ProfileTangibleAsset,
    TangibleAssetStatus,
  } from '$lib/schemas'
  import { getFrequencyItems, getTangibleAssetStatusItems } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

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
  }

  const uid = $props.id()

  let { open = $bindable(), onOpenChange, target, plan }: Props = $props()

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
    // Tangible asset
    value: number | undefined
    status: TangibleAssetStatus
    // Tangible asset (financed) + liability share these
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    // Liability advanced
    interest_type: InterestType
    compounding_frequency: CompoundingFrequency
  }

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

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
      value: undefined,
      status: 'fully_owned',
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      interest_type: 'compound',
      compounding_frequency: 'daily',
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
    } else {
      const l = src.initial
      f.outstanding_balance = l.outstanding_balance > 0 ? l.outstanding_balance : undefined
      f.installment_frequency = l.installment_frequency
      f.annual_rate = l.annual_rate > 0 ? l.annual_rate : undefined
      f.installment_amount = l.installment_amount > 0 ? l.installment_amount : undefined
      f.remaining_term = l.remaining_term > 0 ? l.remaining_term : undefined
      f.interest_type = l.interest_type ?? 'compound'
      f.compounding_frequency = l.compounding_frequency ?? 'daily'
    }
    return f
  }

  let form = $state<FormState>(blankForm())
  // Liability "Show advanced options" disclosure. Auto-expands when the
  // liability already carries non-default interest settings so the user can
  // see what's driving the math.
  let showLiabilityAdvanced = $state(false)

  // Re-seed form whenever the dialog opens.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(target)
      if (target.kind === 'liability') {
        showLiabilityAdvanced =
          target.initial?.interest_type !== undefined ||
          target.initial?.compounding_frequency !== undefined
      } else {
        showLiabilityAdvanced = false
      }
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  const listConfig = $derived(PROFILE_LISTS[kind])

  const isIncluded = $derived(isNew ? true : isIncludedInPlan(listConfig, form.id, plan))

  let entryFeeTypeItems: SelectFieldItem<EntryFeeType>[] = $derived([
    { value: 'ongoing', label: $_('page.plan.entryFeeOngoing') },
    { value: 'upfront', label: $_('page.plan.entryFeeUpfront') },
    { value: 'forty-sixty', label: $_('page.plan.entryFeeFortySixty') },
  ])

  let exitFeeTypeItems: SelectFieldItem<ExitFeeType>[] = $derived([
    { value: 'percentage', label: $_('page.plan.exitFeePercentage') },
    { value: 'fixed', label: $_('page.plan.exitFeeFixed') },
  ])

  let tangibleAssetStatusItems = $derived(getTangibleAssetStatusItems($_))

  let frequencyItems = $derived(getFrequencyItems($_))

  let interestTypeItems: SelectFieldItem<InterestType>[] = $derived([
    { value: 'compound', label: $_('page.plan.interestCompound') },
    { value: 'simple', label: $_('page.plan.interestSimple') },
  ])

  let compoundingFrequencyItems: SelectFieldItem<CompoundingFrequency>[] = $derived([
    { value: 'daily', label: $_('page.plan.compoundingDaily') },
    { value: 'monthly', label: $_('page.setup.common.monthly') },
    { value: 'yearly', label: $_('page.setup.common.yearly') },
  ])

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
    }
  }

  function projectLiability(f: FormState): ProfileLiability {
    // interest_type collapses to undefined when 'compound' (matches the
    // calculation default). compounding_frequency is always persisted —
    // 'daily' in the UI must produce daily compounding in the math, not
    // silently fall back to the installment-frequency legacy default.
    return {
      id: f.id,
      name: f.name,
      outstanding_balance: f.outstanding_balance ?? 0,
      installment_frequency: f.installment_frequency,
      annual_rate: f.annual_rate ?? 0,
      installment_amount: f.installment_amount ?? 0,
      remaining_term: f.remaining_term ?? 0,
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
    duplicateProfileItem(listConfig, form.id, (name) =>
      $_('page.setup.common.copySuffix', { values: { name } }),
    )
    close()
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

<ItemEditDialogShell
  bind:open
  {onOpenChange}
  name={form.name}
  onNameChange={(v) => (form.name = v)}
  {isNew}
  {isIncluded}
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  {#if kind === 'investment'}
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-currentBalance">{$_('page.setup.investments.currentBalance')}</Label>
        <SuffixedInput
            id="{uid}-currentBalance"
          value={form.balance}
          suffix={currencyLabel}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.balance = v)}
        />
      </div>
      <div class="flex w-32 flex-col gap-2">
        <Label for="{uid}-apy">{$_('page.setup.investments.apy')}</Label>
        <SuffixedInput
            id="{uid}-apy"
          value={form.apy}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.apy = v)}
        />
      </div>
    </div>

    <Separator />

    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Receipt class="size-4" />
      <span class="text-xs font-medium uppercase tracking-wide">
        {$_('page.plan.expensesSection')}
      </span>
    </div>

    <!-- Total expense ratio -->
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-totalExpenseRatio">{$_('page.plan.totalExpenseRatio')}</Label>
        <SuffixedInput
            id="{uid}-totalExpenseRatio"
          value={form.ter}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.ter = v)}
        />
      </div>
      <HelpTooltip text={$_('page.plan.totalExpenseRatioDescription')} class="mb-2" />
    </div>

    <!-- Entry fee + payment type -->
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-entryFee">{$_('page.plan.entryFee')}</Label>
        <SuffixedInput
            id="{uid}-entryFee"
          value={form.entry_fee}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.entry_fee = v)}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-entryFeePaymentType">{$_('page.plan.entryFeePaymentType')}</Label>
        <SelectField
            id="{uid}-entryFeePaymentType"
          value={form.entry_fee_type}
          items={entryFeeTypeItems}
          onValueChange={(v) => {
            if (v) form.entry_fee_type = v
          }}
        />
      </div>
      <HelpTooltip text={$_('page.plan.entryFeeDescription')} class="mb-2" />
    </div>

    <!-- Exit fee type + value -->
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-exitFee">{$_('page.plan.exitFee')}</Label>
        <SelectField
            id="{uid}-exitFee"
          value={form.exit_fee_type}
          items={exitFeeTypeItems}
          onValueChange={(v) => {
            if (v) form.exit_fee_type = v
          }}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <SuffixedInput
          value={form.exit_fee}
          suffix={form.exit_fee_type === 'fixed' ? currencyLabel : '%'}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.exit_fee = v)}
        />
      </div>
      <HelpTooltip text={$_('page.plan.exitFeeDescription')} class="mb-2" />
    </div>
  {:else if kind === 'tangibleAsset'}
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-currentValue">{$_('page.setup.tangibleAssets.currentValue')}</Label>
        <SuffixedInput
            id="{uid}-currentValue"
          value={form.value}
          suffix={currencyLabel}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.value = v)}
        />
      </div>
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-status">{$_('page.setup.tangibleAssets.status')}</Label>
        <SelectField
            id="{uid}-status"
          value={form.status}
          items={tangibleAssetStatusItems}
          onValueChange={(v) => {
            if (v) form.status = v
          }}
        />
      </div>
    </div>

    {#if form.status === 'financed'}
      <div class="flex flex-col gap-2">
        <Label for="{uid}-outstandingBalance">{$_('page.setup.tangibleAssets.outstandingBalance')}</Label>
        <SuffixedInput
            id="{uid}-outstandingBalance"
          value={form.outstanding_balance}
          suffix={currencyLabel}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.outstanding_balance = v)}
        />
      </div>
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-installmentFrequency">{$_('page.setup.tangibleAssets.installmentFrequency')}</Label>
          <SelectField
            id="{uid}-installmentFrequency"
            value={form.installment_frequency}
            items={frequencyItems}
            onValueChange={(v) => {
              if (v) form.installment_frequency = v
            }}
          />
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-annualRate">{$_('page.setup.tangibleAssets.annualRate')}</Label>
          <SuffixedInput
            id="{uid}-annualRate"
            value={form.annual_rate}
            suffix="%"
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (form.annual_rate = v)}
          />
        </div>
      </div>
      <div class="flex items-end gap-2">
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-installmentAmount">{$_('page.setup.tangibleAssets.installmentAmount')}</Label>
          <SuffixedInput
            id="{uid}-installmentAmount"
            value={form.installment_amount}
            suffix={currencyLabel}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (form.installment_amount = v)}
          />
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <Label for="{uid}-remainingTerm">{$_('page.setup.tangibleAssets.remainingTerm')}</Label>
          <SuffixedInput
            id="{uid}-remainingTerm"
            value={form.remaining_term}
            suffix={$_('page.setup.tangibleAssets.years')}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (form.remaining_term = v)}
          />
        </div>
      </div>
    {/if}
  {:else}
    <!-- liability -->
    <div class="flex flex-col gap-2">
      <Label for="{uid}-outstandingBalance2">{$_('page.setup.liabilities.outstandingBalance')}</Label>
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
        <Label for="{uid}-installmentFrequency2">{$_('page.setup.liabilities.installmentFrequency')}</Label>
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
        <Label for="{uid}-installmentAmount2">{$_('page.setup.liabilities.installmentAmount')}</Label>
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
        <SuffixedInput
            id="{uid}-remainingTerm2"
          value={form.remaining_term}
          suffix={$_('page.setup.liabilities.years')}
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => (form.remaining_term = v)}
        />
      </div>
    </div>

    <!-- Show / Hide advanced options -->
    <button
      type="button"
      onclick={() => (showLiabilityAdvanced = !showLiabilityAdvanced)}
      class="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <Settings2 class="size-4" />
      <span>
        {showLiabilityAdvanced
          ? $_('page.plan.hideAdvancedOptions')
          : $_('page.plan.showAdvancedOptions')}
      </span>
    </button>

    {#if showLiabilityAdvanced}
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
  {/if}
</ItemEditDialogShell>
