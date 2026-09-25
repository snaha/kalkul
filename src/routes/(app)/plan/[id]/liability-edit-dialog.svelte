<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right'
  import Trash2 from '@lucide/svelte/icons/trash-2'

  import DateAgeSelector from '$lib/components/date-age-selector.svelte'
  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import { itemsForPlan } from '$lib/plan-owned'
  import { installmentAmountForLoan, termYearsForLoan } from '$lib/plan-projection'
  import type {
    CashFlowStart,
    CompoundingFrequency,
    Frequency,
    InterestType,
    LiabilityPayOff,
    ProfileLiability,
  } from '$lib/schemas'
  import { timingComplete } from '$lib/schemas'
  import {
    getCompoundingFrequencyItems,
    getFrequencyItems,
    getInterestTypeItems,
    getLiabilityPayOffItems,
  } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'
  import { getMonthOptions, getYearOptions, monthToOption, optionToMonth } from '$lib/utils'

  import ItemEditDialogShell from './item-edit-dialog-shell.svelte'
  import {
    PROFILE_LISTS,
    duplicateProfileItem,
    isIncludedInPlan,
    removeProfileItem,
    toggleIncludedInPlan,
    upsertProfileItem,
  } from './profile-lists'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial: ProfileLiability | undefined
    plan: PortfolioStore
    /** Called with the copy's id after a duplicate, so the caller can open it. */
    onDuplicated?: (id: string) => void
  }

  const uid = $props.id()

  let { open = $bindable(), onOpenChange, initial, plan, onDuplicated }: Props = $props()

  const years = getYearOptions()
  let months = $derived(getMonthOptions($locale ?? undefined))
  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  interface FormState {
    id: string
    name: string
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    /** Term in years — the Figma dialog is years-only. */
    remaining_term: number | undefined
    start: CashFlowStart
    start_year: number | undefined
    start_month: number | undefined
    start_age: number | undefined
    pay_off: LiabilityPayOff
    pay_off_year: number | undefined
    pay_off_month: number | undefined
    interest_type: InterestType
    compounding_frequency: CompoundingFrequency | undefined
  }

  function blankForm(): FormState {
    const counter = itemsForPlan(appStore.profile.liabilities, plan.id).length + 1
    return {
      id: crypto.randomUUID(),
      name: $_('page.setup.liabilities.defaultName', { values: { index: counter } }),
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      // New liabilities start "Now" per the Figma; an absent start on stored
      // data keeps meaning "from the plan's first year".
      start: 'now',
      start_year: undefined,
      start_month: undefined,
      start_age: undefined,
      pay_off: 'at_term',
      pay_off_year: undefined,
      pay_off_month: undefined,
      interest_type: 'simple',
      compounding_frequency: undefined,
    }
  }

  function seedForm(src: ProfileLiability | undefined): FormState {
    const f = blankForm()
    if (!src) return f
    f.id = src.id
    f.name = src.name
    f.outstanding_balance = src.outstanding_balance > 0 ? src.outstanding_balance : undefined
    f.installment_frequency = src.installment_frequency
    f.annual_rate = src.annual_rate > 0 ? src.annual_rate : undefined
    f.installment_amount = src.installment_amount > 0 ? src.installment_amount : undefined
    // Legacy data may store the term in months; the Figma dialog is years-only.
    f.remaining_term =
      src.remaining_term > 0
        ? src.remaining_term_unit === 'months'
          ? src.remaining_term / 12
          : src.remaining_term
        : undefined
    f.start = src.start ?? 'immediately'
    f.start_year = src.start_year
    f.start_month = src.start_month
    f.start_age = src.start_age
    f.pay_off = src.pay_off ?? 'at_term'
    f.pay_off_year = src.pay_off_year
    f.pay_off_month = src.pay_off_month
    // Legacy rows omit interest_type (the engine then compounds at the
    // installment frequency); a stored compounding frequency means they were
    // compound, otherwise simple is the exact equivalent.
    f.interest_type = src.interest_type ?? (src.compounding_frequency ? 'compound' : 'simple')
    f.compounding_frequency = src.compounding_frequency
    return f
  }

  function projectLiability(f: FormState): ProfileLiability {
    return {
      id: f.id,
      name: f.name,
      outstanding_balance: f.outstanding_balance ?? 0,
      installment_frequency: f.installment_frequency,
      annual_rate: f.annual_rate ?? 0,
      installment_amount: f.installment_amount ?? 0,
      remaining_term: f.remaining_term ?? 0,
      remaining_term_unit: 'years',
      // 'immediately' is the engine default, so it collapses to undefined.
      ...(f.start !== 'immediately'
        ? {
            start: f.start,
            start_year: f.start === 'at_specific_date' ? f.start_year : undefined,
            start_month: f.start === 'at_specific_date' ? f.start_month : undefined,
            start_age: f.start === 'when_age_is' ? f.start_age : undefined,
          }
        : {}),
      // 'at_term' is the engine default, so it collapses to undefined.
      ...(f.pay_off === 'at_specific_date'
        ? { pay_off: f.pay_off, pay_off_year: f.pay_off_year, pay_off_month: f.pay_off_month }
        : {}),
      interest_type: f.interest_type,
      compounding_frequency: f.interest_type === 'compound' ? f.compounding_frequency : undefined,
    }
  }

  let form = $state<FormState>(blankForm())
  // Add reveals the advanced block through the footer switch; Edit shows it by
  // default (the Figma edit frame has no switch, only a delete button).
  let showAdvanced = $state(false)

  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(initial)
      showAdvanced = initial !== undefined
      derivedFrom = 'term'
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  const listConfig = PROFILE_LISTS.liability
  const isIncluded = $derived(isNew ? true : isIncludedInPlan(listConfig, form.id, plan))

  let frequencyItems = $derived(getFrequencyItems($_))
  let interestTypeItems = $derived(getInterestTypeItems($_))
  let compoundingFrequencyItems = $derived(getCompoundingFrequencyItems($_))
  let payOffItems = $derived(getLiabilityPayOffItems($_))
  let yearItems = $derived(years.map((y) => ({ value: y, label: y })))

  function round(value: number, decimals: number): number {
    const factor = 10 ** decimals
    return Math.round((value + Number.EPSILON) * factor) / factor
  }

  function loanTerms() {
    return {
      outstanding_balance: form.outstanding_balance ?? 0,
      installment_frequency: form.installment_frequency,
      annual_rate: form.annual_rate ?? 0,
      interest_type: form.interest_type,
      compounding_frequency: form.compounding_frequency,
    }
  }

  // Installment amount ⇄ Term (issue #258): the field the user last edited is
  // the anchor and the other is derived from the principal, rate and frequency.
  // Changing any of those inputs re-derives the anchor's counterpart, so
  // editing the percentage updates the payment (or the term).
  let derivedFrom = $state<'amount' | 'term'>('term')

  function rederiveFromAnchor(): void {
    if (derivedFrom === 'term') {
      if ((form.remaining_term ?? 0) <= 0) return
      const amount = installmentAmountForLoan({
        ...loanTerms(),
        remaining_term: form.remaining_term as number,
      })
      if (amount !== undefined) form.installment_amount = round(amount, 2)
    } else {
      if ((form.installment_amount ?? 0) <= 0) return
      const term = termYearsForLoan({
        ...loanTerms(),
        remaining_term: 0,
        installment_amount: form.installment_amount as number,
      })
      if (term !== undefined) form.remaining_term = round(term, 2)
    }
  }

  function onInstallmentAmountChange(v: number | undefined): void {
    form.installment_amount = v
    derivedFrom = 'amount'
    rederiveFromAnchor()
  }

  function onTermChange(v: number | undefined): void {
    form.remaining_term = v
    derivedFrom = 'term'
    rederiveFromAnchor()
  }

  function onLoanInputChange(): void {
    rederiveFromAnchor()
  }

  const canSave = $derived(
    (form.outstanding_balance ?? 0) > 0 &&
      timingComplete(form.start, form.start_year, form.start_month, form.start_age) &&
      (form.pay_off !== 'at_specific_date' ||
        (form.pay_off_year !== undefined && form.pay_off_month !== undefined)) &&
      // Compound interest must state its cadence.
      (form.interest_type !== 'compound' || form.compounding_frequency !== undefined),
  )

  function close(): void {
    onOpenChange(false)
  }

  function save(): void {
    upsertProfileItem(listConfig, projectLiability(form), plan)
    close()
  }

  function duplicate(): void {
    const hasChanges = JSON.stringify(form) !== JSON.stringify(seedForm(initial))
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

  function toggleExclude(): void {
    toggleIncludedInPlan(listConfig, form.id, plan)
    close()
  }

  function remove(): void {
    if (!window.confirm($_('page.plan.deleteLiabilityConfirm'))) return
    removeProfileItem(listConfig, form.id)
    close()
  }
</script>

{#snippet liabilityFooter()}
  {#if isNew}
    <!-- Figma 1327: Create + Cancel on the left, the advanced switch on the right. -->
    <div class="flex flex-1 items-center gap-2">
      <Button disabled={!canSave} onclick={save}>{$_('page.plan.createItem')}</Button>
      <Button variant="outline" onclick={close}>{$_('page.plan.cancel')}</Button>
      <div class="flex flex-1 items-center justify-end gap-2">
        <label class="flex cursor-pointer items-center gap-2">
          <Switch checked={showAdvanced} onCheckedChange={(v) => (showAdvanced = v === true)} />
          <span class="text-sm">{$_('page.plan.showAdvancedOptions')}</span>
        </label>
      </div>
    </div>
  {:else}
    <!-- Figma 1331: Save changes + Cancel on the left, delete on the right. -->
    <div class="flex flex-1 items-center gap-2">
      <Button disabled={!canSave} onclick={save}>{$_('page.plan.saveChanges')}</Button>
      <Button variant="outline" onclick={close}>{$_('page.plan.cancel')}</Button>
      <div class="flex flex-1 items-center justify-end gap-2">
        <Button
          variant="destructive"
          size="icon"
          onclick={remove}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      </div>
    </div>
  {/if}
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
  newTitle={$_('page.setup.liabilities.addLiability')}
  footer={liabilityFooter}
  footerClass="bg-muted"
  onSave={save}
  onDuplicate={duplicate}
  onToggleInclude={toggleExclude}
  onDelete={remove}
>
  <!-- Label -->
  <div class="flex flex-col gap-2">
    <Label for="{uid}-liabilityLabel">{$_('page.plan.liabilityLabel')}</Label>
    <Input
      id="{uid}-liabilityLabel"
      value={form.name}
      oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
    />
  </div>

  <!-- Start -->
  <DateAgeSelector
    mode="start"
    value={form.start}
    year={form.start_year}
    month={form.start_month}
    age={form.start_age}
    {years}
    {months}
    birthDateSet={appStore.profile.birth_date !== undefined}
    description={$_('page.plan.liabilityStartDescription')}
    formatNumber={appStore.formatNumber}
    onValueChange={(v) => (form.start = v)}
    onYearChange={(v) => (form.start_year = v)}
    onMonthChange={(v) => (form.start_month = v)}
    onAgeChange={(v) => (form.start_age = v)}
  />

  <!-- Principal -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-principal">{$_('page.plan.principal')}</Label>
      <SuffixedInput
        id="{uid}-principal"
        value={form.outstanding_balance}
        suffix={currencyLabel}
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => {
          form.outstanding_balance = v
          onLoanInputChange()
        }}
      />
    </div>
    <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
      {$_('page.plan.principalDescription')}
    </p>
  </div>

  <!-- Installment frequency | Annual percentage rate -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-installmentFrequency"
        >{$_('page.setup.liabilities.installmentFrequency')}</Label
      >
      <SelectField
        id="{uid}-installmentFrequency"
        value={form.installment_frequency}
        items={frequencyItems}
        onValueChange={(v) => {
          if (v) {
            form.installment_frequency = v
            onLoanInputChange()
          }
        }}
      />
    </div>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-annualRate">{$_('page.setup.liabilities.annualRate')}</Label>
      <SuffixedInput
        id="{uid}-annualRate"
        value={form.annual_rate}
        suffix="%"
        formatNumber={appStore.formatNumber}
        onValueChange={(v) => {
          form.annual_rate = v
          onLoanInputChange()
        }}
      />
    </div>
  </div>

  <!-- Installment amount ⇄ Term -->
  <div class="flex items-end gap-2">
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-installmentAmount">{$_('page.setup.liabilities.installmentAmount')}</Label>
      <SuffixedInput
        id="{uid}-installmentAmount"
        value={form.installment_amount}
        suffix={currencyLabel}
        formatNumber={appStore.formatNumber}
        onValueChange={onInstallmentAmountChange}
      />
    </div>
    <span class="flex h-8 shrink-0 items-center text-muted-foreground" aria-hidden="true">
      <ArrowLeftRight class="size-4" />
    </span>
    <div class="flex flex-1 flex-col gap-2">
      <Label for="{uid}-term">{$_('page.plan.term')}</Label>
      <SuffixedInput
        id="{uid}-term"
        value={form.remaining_term}
        suffix={$_('page.plan.termYears')}
        formatNumber={appStore.formatNumber}
        onValueChange={onTermChange}
      />
    </div>
  </div>

  {#if showAdvanced}
    <Separator />

    <!-- Pay-off -->
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-payOff">{$_('page.plan.payOff')}</Label>
        <SelectField
          id="{uid}-payOff"
          value={form.pay_off}
          items={payOffItems}
          onValueChange={(v) => {
            if (v) form.pay_off = v
          }}
        />
      </div>
      {#if form.pay_off === 'at_specific_date'}
        <div class="flex flex-1 items-center gap-2">
          <SelectField
            class="max-w-24"
            aria-label={$_('page.setup.aboutYou.selectYear')}
            value={form.pay_off_year !== undefined ? String(form.pay_off_year) : ''}
            items={yearItems}
            onValueChange={(v) => {
              if (v) form.pay_off_year = Number(v)
            }}
          />
          <SelectField
            aria-label={$_('page.setup.aboutYou.selectMonth')}
            value={form.pay_off_month !== undefined ? monthToOption(form.pay_off_month) : ''}
            items={months}
            onValueChange={(v) => {
              if (v) form.pay_off_month = optionToMonth(v)
            }}
          />
          <HelpTooltip text={$_('page.plan.payOffDescription')} />
        </div>
      {:else}
        <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
          {$_('page.plan.payOffDescription')}
        </p>
      {/if}
    </div>

    <!-- Interest type | Compounding frequency -->
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for="{uid}-interestType">{$_('page.plan.interestType')}</Label>
        <SelectField
          id="{uid}-interestType"
          value={form.interest_type}
          items={interestTypeItems}
          onValueChange={(v) => {
            if (v) {
              form.interest_type = v
              onLoanInputChange()
            }
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
              if (v) {
                form.compounding_frequency = v
                onLoanInputChange()
              }
            }}
          />
        </div>
      {:else}
        <div class="flex-1"></div>
      {/if}
      <HelpTooltip text={$_('page.plan.interestDescription')} class="mb-2" />
    </div>
  {/if}
</ItemEditDialogShell>
