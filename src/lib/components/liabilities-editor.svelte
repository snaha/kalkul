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
  }

  const editor = createListEditor<ProfileLiability, LiabilityUI>({
    load: () => appStore.profile.liabilities,
    toUI: (l) => ({
      id: l.id,
      name: l.name,
      outstanding_balance: l.outstanding_balance > 0 ? l.outstanding_balance : undefined,
      installment_frequency: l.installment_frequency,
      annual_rate: l.annual_rate > 0 ? l.annual_rate : undefined,
      installment_amount: l.installment_amount > 0 ? l.installment_amount : undefined,
      remaining_term: l.remaining_term > 0 ? l.remaining_term : undefined,
      remaining_term_unit: l.remaining_term_unit ?? 'years',
      interest_type: l.interest_type ?? 'compound',
      compounding_frequency: l.compounding_frequency,
      // Reveal the options when the liability already has them, so values set
      // in the plan dialog are not hidden here.
      showAdvanced: l.interest_type !== undefined || l.compounding_frequency !== undefined,
      editing: false,
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
      interest_type: 'compound',
      compounding_frequency: undefined,
      showAdvanced: false,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (l) => (l.outstanding_balance ?? 0) > 0,
    toStored: (l) => ({
      id: l.id,
      name: l.name,
      outstanding_balance: l.outstanding_balance ?? 0,
      installment_frequency: l.installment_frequency,
      annual_rate: l.annual_rate ?? 0,
      installment_amount: l.installment_amount ?? 0,
      remaining_term: l.remaining_term ?? 0,
      remaining_term_unit: l.remaining_term_unit,
      // 'compound' is the calculation default, so it collapses to undefined;
      // the frequency is only stored once the user actually picks one, so an
      // untouched liability keeps the legacy default (compounding at the
      // installment frequency). Showing/hiding the advanced block is a display
      // toggle and never changes what is stored.
      interest_type: l.interest_type !== 'compound' ? l.interest_type : undefined,
      compounding_frequency: l.compounding_frequency,
    }),
    // has_liabilities belongs to the Get started checkbox, not to this list:
    // re-deriving it here unchecked the box (and dropped the step from the
    // flow) the moment a seeded card was collapsed without a value.
    persist: (data) => appStore.updateProfile({ liabilities: data }),
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
                  liability.installment_frequency = v
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
                onValueChange={(v) => {
                  liability.installment_amount = v
                }}
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
                  onValueChange={(v) => {
                    liability.remaining_term = v
                  }}
                />
                <SelectField
                  id="remainingTermUnit-{liability.id}"
                  value={liability.remaining_term_unit}
                  items={remainingTermUnitItems}
                  onValueChange={(v) => {
                    if (v) liability.remaining_term_unit = v
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
                    if (v) liability.interest_type = v
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
                      if (v) liability.compounding_frequency = v
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
