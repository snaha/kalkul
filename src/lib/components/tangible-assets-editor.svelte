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
    Frequency,
    ProfileTangibleAsset,
    RemainingTermUnit,
    TangibleAssetStatus,
    ValueOverTime,
  } from '$lib/schemas'
  import {
    getFrequencyItems,
    getRemainingTermUnitItems,
    getTangibleAssetStatusItems,
    getValueOverTimeItems,
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
    // Value over time and property tax are attributes of the asset itself, not
    // of the financing, so they show for any status. Planned purchase/sale and
    // the loan's interest type stay in the plan dialog and round-trip via prev.
    value_over_time: ValueOverTime
    value_rate: number | undefined
    property_tax_rate: number | undefined
    // UI-only: whether the value/tax options are revealed, toggled from the
    // card menu.
    showAdvanced: boolean
    editing: boolean
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
      value_over_time: a.value_over_time ?? 'appreciate',
      value_rate: a.value_rate,
      property_tax_rate: a.property_tax_rate,
      // Reveal the options when the asset already has them set, so values are
      // not hidden here.
      showAdvanced: a.value_rate !== undefined || a.property_tax_rate !== undefined,
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
      value_over_time: 'appreciate',
      value_rate: undefined,
      property_tax_rate: undefined,
      showAdvanced: false,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (a) => (a.value ?? 0) > 0,
    // Spread the stored asset first so the plan-dialog-only fields — planned
    // purchase/sale and the loan's interest type/compounding — survive an edit
    // here. Only the rendered fields override it.
    toStored: (a, prev) => ({
      ...prev,
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
      value_over_time: a.value_over_time,
      value_rate: a.value_rate,
      property_tax_rate: a.property_tax_rate,
    }),
    // has_tangible_assets belongs to the Get started checkbox, not to this
    // list: re-deriving it here unchecked the box (and dropped the step from
    // the flow) the moment a seeded card was collapsed without a value.
    persist: (data) => appStore.updateProfile({ tangible_assets: data }),
  })
  onDestroy(editor.flushSave)

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let statusItems = $derived(getTangibleAssetStatusItems($_))

  let frequencyItems = $derived(getFrequencyItems($_))

  let remainingTermUnitItems = $derived(getRemainingTermUnitItems($_))

  let valueOverTimeItems = $derived(getValueOverTimeItems($_))

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
        onAdvancedChange={(checked) => {
          asset.showAdvanced = checked
        }}
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
          {/if}

          {#if asset.showAdvanced}
            <Separator />

            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="valueOverTime-{asset.id}">{$_('page.plan.valueOverTime')}</Label>
                <SelectField
                  id="valueOverTime-{asset.id}"
                  value={asset.value_over_time}
                  items={valueOverTimeItems}
                  onValueChange={(v) => {
                    if (v) asset.value_over_time = v
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label for="valueRate-{asset.id}">{$_('page.plan.valueAnnualRate')}</Label>
                <SuffixedInput
                  id="valueRate-{asset.id}"
                  value={asset.value_rate}
                  suffix="%"
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    asset.value_rate = v
                  }}
                />
              </div>
            </div>

            <div class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label for="propertyTax-{asset.id}">{$_('page.plan.propertyTax')}</Label>
                <SuffixedInput
                  id="propertyTax-{asset.id}"
                  value={asset.property_tax_rate}
                  suffix="%"
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    asset.property_tax_rate = v
                  }}
                />
              </div>
              <HelpTooltip text={$_('page.plan.propertyTaxDescription')} class="mb-2" />
            </div>
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
