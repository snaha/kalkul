<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import type { Frequency, ProfileLiability } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented } from '$lib/utils'

  interface LiabilityUI {
    id: string
    name: string
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
    editing: boolean
    editingName: boolean
  }

  interface Props {
    onHasValueChange?: (hasValue: boolean) => void
  }

  let { onHasValueChange }: Props = $props()

  function storedToUI(stored: ProfileLiability[]): LiabilityUI[] {
    return stored.map((l) => ({
      id: l.id,
      name: l.name,
      outstanding_balance: l.outstanding_balance > 0 ? l.outstanding_balance : undefined,
      installment_frequency: l.installment_frequency,
      annual_rate: l.annual_rate > 0 ? l.annual_rate : undefined,
      installment_amount: l.installment_amount > 0 ? l.installment_amount : undefined,
      remaining_term: l.remaining_term > 0 ? l.remaining_term : undefined,
      editing: false,
      editingName: false,
    }))
  }

  // The store is loaded before render (see +layout.ts), so the profile is
  // already populated here — seed the form state directly.
  const initial = storedToUI(appStore.profile.liabilities ?? [])
  let liabilities = $state<LiabilityUI[]>(initial)
  let liabilityCounter = $state(initial.length)

  $effect(() => {
    onHasValueChange?.(liabilities.some((l) => (l.outstanding_balance ?? 0) > 0))
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let frequencyItems = $derived([
    { value: 'monthly', label: $_('page.setup.common.monthly') },
    { value: 'yearly', label: $_('page.setup.common.yearly') },
    { value: 'weekly', label: $_('page.setup.common.weekly') },
  ])

  function addLiability() {
    liabilityCounter++
    for (const l of liabilities) l.editing = false
    liabilities.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.liabilities.defaultName', { values: { index: liabilityCounter } }),
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      editing: true,
      editingName: false,
    })
  }

  function duplicateLiability(liability: LiabilityUI) {
    liabilityCounter++
    const idx = liabilities.indexOf(liability)
    liabilities.splice(idx + 1, 0, {
      ...liability,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: liability.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteLiability(liability: LiabilityUI) {
    const idx = liabilities.indexOf(liability)
    if (idx !== -1) liabilities.splice(idx, 1)
  }

  function formatBalance(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrency(val)
  }

  function save() {
    const data: ProfileLiability[] = liabilities
      .filter((l) => l.name.trim().length > 0 || (l.outstanding_balance ?? 0) > 0)
      .map((l) => ({
        id: l.id,
        name: l.name,
        outstanding_balance: l.outstanding_balance ?? 0,
        installment_frequency: l.installment_frequency,
        annual_rate: l.annual_rate ?? 0,
        installment_amount: l.installment_amount ?? 0,
        remaining_term: l.remaining_term ?? 0,
      }))
    appStore.updateProfile({
      liabilities: data,
      has_liabilities: data.length > 0,
    })
  }
  // Auto-save on any edit, debounced so rapid typing does one schema-parse +
  // localStorage write instead of one per keystroke. save() can throw on
  // transient invalid mid-edit data, so it's guarded. Skip the first (mount)
  // run so merely viewing the page doesn't rewrite the profile (and bump
  // "last updated") without a real change.
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  function flushSave() {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    try {
      save()
    } catch {
      /* transient invalid mid-edit */
    }
  }
  let autoSaveArmed = false
  $effect(() => {
    $state.snapshot(liabilities) // track every field so edits re-run this effect
    if (!autoSaveArmed) {
      autoSaveArmed = true
      return
    }
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, 300)
  })
  onDestroy(flushSave)
</script>

<div class="flex w-full flex-col gap-4">
  {#each liabilities as liability, idx (liability.id)}
    <EditableItemCard
      item={liability}
      collapsedValue={formatBalance(liability.outstanding_balance)}
      dotColor={CATEGORY_COLORS.liabilities[idx % CATEGORY_COLORS.liabilities.length]}
      onToggleEditing={() => {
        liability.editing = !liability.editing
      }}
      onDuplicate={() => duplicateLiability(liability)}
      onDelete={() => deleteLiability(liability)}
      onStartEditingName={() => {
        liability.editingName = true
      }}
      onStopEditingName={() => {
        liability.editingName = false
      }}
    >
      {#snippet expandedContent()}
        <div class="flex flex-col gap-2">
          <Label>{$_('page.setup.liabilities.outstandingBalance')}</Label>
          <SuffixedInput
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
            <Label>{$_('page.setup.liabilities.installmentFrequency')}</Label>
            <SelectField
              value={liability.installment_frequency}
              items={frequencyItems}
              onValueChange={(v) => {
                liability.installment_frequency = v as Frequency
              }}
            />
          </div>
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.liabilities.annualRate')}</Label>
            <SuffixedInput
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
            <Label>{$_('page.setup.liabilities.installmentAmount')}</Label>
            <SuffixedInput
              value={liability.installment_amount}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => {
                liability.installment_amount = v
              }}
            />
          </div>
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.liabilities.remainingTerm')}</Label>
            <SuffixedInput
              value={liability.remaining_term}
              suffix={$_('page.setup.liabilities.years')}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => {
                liability.remaining_term = v
              }}
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Switch checked={false} onCheckedChange={notImplemented} />
          <span class="text-sm font-medium text-muted-foreground">
            {$_('page.setup.common.advancedOptions')}
          </span>
        </div>
      {/snippet}
    </EditableItemCard>
  {/each}

  <div>
    <Button variant="secondary" onclick={addLiability}>
      <Plus class="size-4" />
      {$_('page.setup.liabilities.addLiability')}
    </Button>
  </div>
</div>
