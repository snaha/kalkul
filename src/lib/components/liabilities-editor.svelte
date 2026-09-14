<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right'
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
  import { planOwnedItems, sharedItems } from '$lib/plan-owned'
  import { installmentAmountForLoan, termYearsForLoan } from '$lib/plan-projection'
  import type {
    CompoundingFrequency,
    Frequency,
    InterestType,
    ProfileLiability,
    RemainingTermUnit,
  } from '$lib/schemas'
  import {
    getCompoundingFrequencyItems,
    getFrequencyItems,
    getInterestTypeItems,
    getRemainingTermUnitItems,
  } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'

  interface LiabilityUI {
    id: string
    name: string
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    remaining_term_unit: RemainingTermUnit
    interest_type: InterestType
    // Absent until the user picks one: the engine's default is to compound at
    // the installment frequency, and merely revealing the advanced block must
    // not silently switch the loan to another cadence.
    compounding_frequency: CompoundingFrequency | undefined
    // UI-only: whether the interest options are revealed, toggled from the
    // card menu.
    showAdvanced: boolean
    editing: boolean
    // UI-only: which of Installment amount / Remaining term the user last
    // edited, so changing the rate/principal/frequency re-derives its
    // counterpart instead of leaving both stale.
    derivedFrom: 'amount' | 'term'
  }

  const editor = createListEditor<ProfileLiability, LiabilityUI>({
    // Financial data holds the shared items only. Those created in a plan
    // carry its id, stay hidden here and are carried through every save.
    load: () => sharedItems(appStore.profile.liabilities),
    toUI: (l) => ({
      id: l.id,
      name: l.name,
      outstanding_balance: l.outstanding_balance > 0 ? l.outstanding_balance : undefined,
      installment_frequency: l.installment_frequency,
      annual_rate: l.annual_rate > 0 ? l.annual_rate : undefined,
      installment_amount: l.installment_amount > 0 ? l.installment_amount : undefined,
      remaining_term: l.remaining_term > 0 ? l.remaining_term : undefined,
      remaining_term_unit: l.remaining_term_unit ?? 'years',
      // Legacy rows omit interest_type (the engine compounds at the installment
      // frequency); a stored compounding frequency means they were compound,
      // otherwise simple is the exact equivalent.
      interest_type: l.interest_type ?? (l.compounding_frequency ? 'compound' : 'simple'),
      compounding_frequency: l.compounding_frequency,
      // Reveal the options when the liability already has them, so values set
      // in the plan dialog are not hidden here.
      showAdvanced: l.interest_type !== undefined || l.compounding_frequency !== undefined,
      editing: false,
      derivedFrom: 'term',
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.liabilities.defaultName', { values: { index } }),
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      remaining_term_unit: 'years',
      interest_type: 'simple',
      compounding_frequency: undefined,
      showAdvanced: false,
      editing: true,
      derivedFrom: 'term',
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (l) => (l.outstanding_balance ?? 0) > 0,
    // Spread the stored item first so the fields this card does not edit
    // (the plan dialog's start* and pay_off* timing) survive a save here.
    toStored: (l, prev) => ({
      ...prev,
      id: l.id,
      name: l.name,
      outstanding_balance: l.outstanding_balance ?? 0,
      installment_frequency: l.installment_frequency,
      annual_rate: l.annual_rate ?? 0,
      installment_amount: l.installment_amount ?? 0,
      remaining_term: l.remaining_term ?? 0,
      remaining_term_unit: l.remaining_term_unit,
      // Compound interest requires a cadence (enforced by the schema);
      // 'simple' has none, so any stale frequency is dropped.
      interest_type: l.interest_type,
      compounding_frequency: l.interest_type === 'compound' ? l.compounding_frequency : undefined,
    }),
    // has_liabilities belongs to the Get started checkbox, not to this list:
    // re-deriving it here unchecked the box (and dropped the step from the
    // flow) the moment a seeded card was collapsed without a value.
    persist: (data) =>
      appStore.updateProfile({
        liabilities: [...data, ...planOwnedItems(appStore.profile.liabilities)],
      }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let frequencyItems = $derived(getFrequencyItems($_))

  let remainingTermUnitItems = $derived(getRemainingTermUnitItems($_))

  let interestTypeItems = $derived(getInterestTypeItems($_))

  let compoundingFrequencyItems = $derived(getCompoundingFrequencyItems($_))

  function formatBalance(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrencyCode(val)
  }

  function round(value: number, decimals: number): number {
    const factor = 10 ** decimals
    return Math.round((value + Number.EPSILON) * factor) / factor
  }

  // Installment amount ⇄ Remaining term (issue #258). The field the user last
  // edited anchors the pair; the other is derived from the outstanding balance,
  // rate and frequency. Changing any of those inputs (or the interest options)
  // re-derives the anchor's counterpart, so editing the percentage updates the
  // payment — or the term. The term is written in the card's chosen unit.
  function rederive(liability: LiabilityUI): void {
    if (liability.derivedFrom === 'term') {
      const years = termYearsFromUnit(liability)
      if (years === undefined) return
      const amount = installmentAmountForLoan({
        outstanding_balance: liability.outstanding_balance ?? 0,
        installment_frequency: liability.installment_frequency,
        annual_rate: liability.annual_rate ?? 0,
        remaining_term: years,
        interest_type: liability.interest_type,
        compounding_frequency: liability.compounding_frequency,
      })
      if (amount !== undefined) liability.installment_amount = round(amount, 2)
    } else {
      const amount = liability.installment_amount
      if (amount === undefined || amount <= 0) return
      const termYears = termYearsForLoan({
        outstanding_balance: liability.outstanding_balance ?? 0,
        installment_frequency: liability.installment_frequency,
        annual_rate: liability.annual_rate ?? 0,
        remaining_term: 0,
        installment_amount: amount,
        interest_type: liability.interest_type,
        compounding_frequency: liability.compounding_frequency,
      })
      if (termYears === undefined) return
      liability.remaining_term =
        liability.remaining_term_unit === 'months' ? round(termYears * 12, 2) : round(termYears, 2)
    }
  }

  function termYearsFromUnit(liability: LiabilityUI): number | undefined {
    if (liability.remaining_term === undefined || liability.remaining_term <= 0) return undefined
    return liability.remaining_term_unit === 'months'
      ? liability.remaining_term / 12
      : liability.remaining_term
  }

  function onInstallmentAmountChange(liability: LiabilityUI, v: number | undefined): void {
    liability.installment_amount = v
    liability.derivedFrom = 'amount'
    rederive(liability)
  }

  function onRemainingTermChange(liability: LiabilityUI, v: number | undefined): void {
    liability.remaining_term = v
    liability.derivedFrom = 'term'
    rederive(liability)
  }

  function onLoanInputChange(liability: LiabilityUI): void {
    rederive(liability)
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as liability (liability.id)}
    <div class="flex flex-col gap-1">
      <EditableItemCard
        item={liability}
        collapsedValue={formatBalance(liability.outstanding_balance)}
        advancedChecked={liability.showAdvanced}
        onAdvancedChange={(checked) => {
          liability.showAdvanced = checked
        }}
        onToggleEditing={() => {
          liability.editing = !liability.editing
        }}
        onDuplicate={() => editor.duplicate(liability)}
        onDelete={() => editor.remove(liability)}
      >
        {#snippet expandedContent()}
          <div class="flex flex-col gap-2">
            <Label for="outstandingBalance-{liability.id}"
              >{$_('page.setup.liabilities.outstandingBalance')}</Label
            >
            <SuffixedInput
              id="outstandingBalance-{liability.id}"
              value={liability.outstanding_balance}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => {
                liability.outstanding_balance = v
                onLoanInputChange(liability)
              }}
            />
          </div>

          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="installmentFrequency-{liability.id}"
                >{$_('page.setup.liabilities.installmentFrequency')}</Label
              >
              <SelectField
                id="installmentFrequency-{liability.id}"
                value={liability.installment_frequency}
                items={frequencyItems}
                onValueChange={(v) => {
                  if (v) {
                    liability.installment_frequency = v
                    onLoanInputChange(liability)
                  }
                }}
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label for="annualRate-{liability.id}"
                >{$_('page.setup.liabilities.annualRate')}</Label
              >
              <SuffixedInput
                id="annualRate-{liability.id}"
                value={liability.annual_rate}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  liability.annual_rate = v
                  onLoanInputChange(liability)
                }}
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="installmentAmount-{liability.id}"
                >{$_('page.setup.liabilities.installmentAmount')}</Label
              >
              <SuffixedInput
                id="installmentAmount-{liability.id}"
                value={liability.installment_amount}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => onInstallmentAmountChange(liability, v)}
              />
            </div>
            <span class="inline-flex h-8 items-center text-muted-foreground">
              <ArrowLeftRight class="size-4" />
            </span>
            <div class="flex flex-1 flex-col gap-2">
              <Label for="remainingTerm-{liability.id}"
                >{$_('page.setup.liabilities.remainingTerm')}</Label
              >
              <div class="flex items-center gap-2">
                <SuffixedInput
                  id="remainingTerm-{liability.id}"
                  value={liability.remaining_term}
                  formatNumber={appStore.formatNumber}
                  class="w-24"
                  onValueChange={(v) => onRemainingTermChange(liability, v)}
                />
                <SelectField
                  id="remainingTermUnit-{liability.id}"
                  value={liability.remaining_term_unit}
                  items={remainingTermUnitItems}
                  onValueChange={(v) => {
                    if (v) {
                      liability.remaining_term_unit = v
                      onLoanInputChange(liability)
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {#if liability.showAdvanced}
            <Separator />

            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="interestType-{liability.id}">{$_('page.plan.interestType')}</Label>
                <SelectField
                  id="interestType-{liability.id}"
                  value={liability.interest_type}
                  items={interestTypeItems}
                  onValueChange={(v) => {
                    if (v) {
                      liability.interest_type = v
                      onLoanInputChange(liability)
                    }
                  }}
                />
              </div>
              {#if liability.interest_type === 'compound'}
                <div class="flex flex-1 flex-col gap-2">
                  <Label for="compoundingFrequency-{liability.id}">
                    {$_('page.plan.compoundingFrequency')}
                  </Label>
                  <SelectField
                    id="compoundingFrequency-{liability.id}"
                    value={liability.compounding_frequency}
                    items={compoundingFrequencyItems}
                    placeholder={$_('page.plan.compoundingDefault')}
                    onValueChange={(v) => {
                      if (v) {
                        liability.compounding_frequency = v
                        onLoanInputChange(liability)
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
        {/snippet}
      </EditableItemCard>
      <EditorItemErrors messages={editor.errors[liability.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.liabilities.addLiability')}
    </Button>
  </div>
</div>
