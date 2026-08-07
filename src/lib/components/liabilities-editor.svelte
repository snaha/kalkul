<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { Frequency, ProfileLiability } from '$lib/schemas'
  import { getFrequencyItems } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'

  interface LiabilityUI {
    id: string
    name: string
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    editing: boolean
  }

  interface Props {
    onHasValueChange?: (hasValue: boolean) => void
  }

  let { onHasValueChange }: Props = $props()

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
    }),
    persist: (data) =>
      appStore.updateProfile({
        liabilities: data,
        has_liabilities: data.length > 0,
      }),
  })
  onDestroy(editor.flushSave)

  $effect(() => {
    onHasValueChange?.(editor.hasAnyValue)
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let frequencyItems = $derived(getFrequencyItems($_))

  function formatBalance(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrency(val)
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as liability, idx (liability.id)}
    <div class="flex flex-col gap-1">
      <EditableItemCard
        item={liability}
        collapsedValue={formatBalance(liability.outstanding_balance)}
        dotColor={CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length]}
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
                  liability.installment_frequency = v as Frequency
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
            <div class="flex flex-1 flex-col gap-2">
              <Label for="remainingTerm-{liability.id}"
                >{$_('page.setup.liabilities.remainingTerm')}</Label
              >
              <SuffixedInput
                id="remainingTerm-{liability.id}"
                value={liability.remaining_term}
                suffix={$_('page.setup.liabilities.years', {
                  values: { count: liability.remaining_term ?? 0 },
                })}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  liability.remaining_term = v
                }}
              />
            </div>
          </div>
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
