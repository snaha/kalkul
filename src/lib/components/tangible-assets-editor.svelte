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
    ProfileTangibleAsset,
    RemainingTermUnit,
    TangibleAssetStatus,
  } from '$lib/schemas'
  import {
    getCompoundingFrequencyItems,
    getFrequencyItems,
    getInterestTypeItems,
    getRemainingTermUnitItems,
    getTangibleAssetStatusItems,
  } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'

  interface AssetUI {
    id: string
    name: string
    value: number | undefined
    status: TangibleAssetStatus
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    remaining_term_unit: RemainingTermUnit
    interest_type: InterestType
    compounding_frequency: CompoundingFrequency
    // UI-only: whether the financing's interest options are revealed, toggled
    // from the card menu.
    showAdvanced: boolean
    editing: boolean
  }

  // The interest options belong to the financing and only exist while the
  // advanced block is visible.
  function isFinancedAdvanced(a: AssetUI): boolean {
    return a.status === 'financed' && a.showAdvanced
  }

  const editor = createListEditor<ProfileTangibleAsset, AssetUI>({
    load: () => appStore.profile.tangible_assets,
    toUI: (a) => ({
      id: a.id,
      name: a.name,
      value: a.value > 0 ? a.value : undefined,
      status: a.status,
      outstanding_balance:
        a.outstanding_balance !== undefined && a.outstanding_balance > 0
          ? a.outstanding_balance
          : undefined,
      installment_frequency: a.installment_frequency ?? 'monthly',
      annual_rate: a.annual_rate !== undefined && a.annual_rate > 0 ? a.annual_rate : undefined,
      installment_amount:
        a.installment_amount !== undefined && a.installment_amount > 0
          ? a.installment_amount
          : undefined,
      remaining_term:
        a.remaining_term !== undefined && a.remaining_term > 0 ? a.remaining_term : undefined,
      remaining_term_unit: a.remaining_term_unit ?? 'years',
      interest_type: a.interest_type ?? 'compound',
      compounding_frequency: a.compounding_frequency ?? 'monthly',
      // Reveal the options when the financing already has them, so values set
      // in the plan dialog are not hidden here.
      showAdvanced: a.interest_type !== undefined || a.compounding_frequency !== undefined,
      editing: false,
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.tangibleAssets.defaultName', { values: { index } }),
      value: undefined,
      status: 'fully_owned',
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      remaining_term_unit: 'years',
      interest_type: 'compound',
      compounding_frequency: 'monthly',
      showAdvanced: false,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (a) => (a.value ?? 0) > 0,
    toStored: (a) => ({
      id: a.id,
      name: a.name,
      value: a.value ?? 0,
      status: a.status,
      outstanding_balance: a.status === 'financed' ? (a.outstanding_balance ?? 0) : undefined,
      installment_frequency: a.status === 'financed' ? a.installment_frequency : undefined,
      annual_rate: a.status === 'financed' ? (a.annual_rate ?? 0) : undefined,
      installment_amount: a.status === 'financed' ? (a.installment_amount ?? 0) : undefined,
      remaining_term: a.status === 'financed' ? (a.remaining_term ?? 0) : undefined,
      remaining_term_unit: a.remaining_term_unit,
      // Financing-only, like the fields above, and stored only while the
      // advanced options are shown so an untouched asset keeps the legacy
      // default (compounding at the installment frequency). 'compound' is the
      // calculation default so it collapses to undefined.
      interest_type:
        isFinancedAdvanced(a) && a.interest_type !== 'compound' ? a.interest_type : undefined,
      compounding_frequency: isFinancedAdvanced(a) ? a.compounding_frequency : undefined,
    }),
    persist: (data) =>
      appStore.updateProfile({
        tangible_assets: data,
        has_tangible_assets: data.length > 0,
      }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let statusItems = $derived(getTangibleAssetStatusItems($_))

  let frequencyItems = $derived(getFrequencyItems($_))

  let remainingTermUnitItems = $derived(getRemainingTermUnitItems($_))

  let interestTypeItems = $derived(getInterestTypeItems($_))

  let compoundingFrequencyItems = $derived(getCompoundingFrequencyItems($_))

  function formatValue(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrencyCode(val)
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as asset (asset.id)}
    <div class="flex flex-col gap-1">
      <EditableItemCard
        item={asset}
        collapsedValue={formatValue(asset.value)}
        badge={asset.status === 'financed' ? $_('page.setup.tangibleAssets.financed') : undefined}
        advancedChecked={asset.showAdvanced}
        onAdvancedChange={asset.status === 'financed'
          ? (checked) => {
              asset.showAdvanced = checked
            }
          : undefined}
        onToggleEditing={() => {
          asset.editing = !asset.editing
        }}
        onDuplicate={() => editor.duplicate(asset)}
        onDelete={() => editor.remove(asset)}
      >
        {#snippet expandedContent()}
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="currentValue-{asset.id}"
                >{$_('page.setup.tangibleAssets.currentValue')}</Label
              >
              <SuffixedInput
                id="currentValue-{asset.id}"
                value={asset.value}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  asset.value = v
                }}
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label for="status-{asset.id}">{$_('page.setup.tangibleAssets.status')}</Label>
              <SelectField
                id="status-{asset.id}"
                value={asset.status}
                items={statusItems}
                onValueChange={(v) => {
                  asset.status = v
                }}
              />
            </div>
          </div>

          {#if asset.status === 'financed'}
            <div class="flex flex-col gap-2">
              <Label for="outstandingBalance-{asset.id}"
                >{$_('page.setup.tangibleAssets.outstandingBalance')}</Label
              >
              <SuffixedInput
                id="outstandingBalance-{asset.id}"
                value={asset.outstanding_balance}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  asset.outstanding_balance = v
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="installmentFrequency-{asset.id}"
                  >{$_('page.setup.tangibleAssets.installmentFrequency')}</Label
                >
                <SelectField
                  id="installmentFrequency-{asset.id}"
                  value={asset.installment_frequency}
                  items={frequencyItems}
                  onValueChange={(v) => {
                    asset.installment_frequency = v
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label for="annualRate-{asset.id}"
                  >{$_('page.setup.tangibleAssets.annualRate')}</Label
                >
                <SuffixedInput
                  id="annualRate-{asset.id}"
                  value={asset.annual_rate}
                  suffix="%"
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    asset.annual_rate = v
                  }}
                />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="installmentAmount-{asset.id}"
                  >{$_('page.setup.tangibleAssets.installmentAmount')}</Label
                >
                <SuffixedInput
                  id="installmentAmount-{asset.id}"
                  value={asset.installment_amount}
                  suffix={currencyLabel}
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    asset.installment_amount = v
                  }}
                />
              </div>
              <span class="inline-flex h-8 items-center text-muted-foreground">
                <ArrowLeftRight class="size-4" />
              </span>
              <div class="flex flex-1 flex-col gap-2">
                <Label for="remainingTerm-{asset.id}"
                  >{$_('page.setup.tangibleAssets.remainingTerm')}</Label
                >
                <div class="flex items-center gap-2">
                  <SuffixedInput
                    id="remainingTerm-{asset.id}"
                    value={asset.remaining_term}
                    formatNumber={appStore.formatNumber}
                    class="w-24"
                    onValueChange={(v) => {
                      asset.remaining_term = v
                    }}
                  />
                  <SelectField
                    id="remainingTermUnit-{asset.id}"
                    value={asset.remaining_term_unit}
                    items={remainingTermUnitItems}
                    onValueChange={(v) => {
                      if (v) asset.remaining_term_unit = v
                    }}
                  />
                </div>
              </div>
            </div>

            {#if asset.showAdvanced}
              <Separator />

              <div class="flex items-end gap-2">
                <div class="flex flex-1 flex-col gap-2">
                  <Label for="interestType-{asset.id}">{$_('page.plan.interestType')}</Label>
                  <SelectField
                    id="interestType-{asset.id}"
                    value={asset.interest_type}
                    items={interestTypeItems}
                    onValueChange={(v) => {
                      if (v) asset.interest_type = v
                    }}
                  />
                </div>
                {#if asset.interest_type === 'compound'}
                  <div class="flex flex-1 flex-col gap-2">
                    <Label for="compoundingFrequency-{asset.id}">
                      {$_('page.plan.compoundingFrequency')}
                    </Label>
                    <SelectField
                      id="compoundingFrequency-{asset.id}"
                      value={asset.compounding_frequency}
                      items={compoundingFrequencyItems}
                      onValueChange={(v) => {
                        if (v) asset.compounding_frequency = v
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
        {/snippet}
      </EditableItemCard>
      <EditorItemErrors messages={editor.errors[asset.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.tangibleAssets.addAsset')}
    </Button>
  </div>
</div>
