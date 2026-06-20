<script lang="ts">
  import { untrack } from 'svelte'
  import { _ } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import type { ProfileInvestment } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented } from '$lib/utils'

  interface InvestmentUI {
    id: string
    name: string
    balance: number | undefined
    apy: number | undefined
    editing: boolean
    editingName: boolean
  }

  interface Props {
    onHasValueChange?: (hasValue: boolean) => void
  }

  let { onHasValueChange }: Props = $props()

  function storedToUI(stored: ProfileInvestment[]): InvestmentUI[] {
    return stored.map((inv) => ({
      id: inv.id,
      name: inv.name,
      balance: inv.balance > 0 ? inv.balance : undefined,
      apy: inv.apy > 0 ? inv.apy : undefined,
      editing: false,
      editingName: false,
    }))
  }

  let investments = $state<InvestmentUI[]>([])
  let investmentCounter = $state(0)
  let hydrated = $state(false)

  $effect(() => {
    if (hydrated || appStore.loading) return
    const stored = appStore.profile.investments
    if (stored && stored.length > 0) {
      investments = storedToUI(stored)
      investmentCounter = investments.length
    }
    hydrated = true
  })

  $effect(() => {
    onHasValueChange?.(investments.some((i) => (i.balance ?? 0) > 0))
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function addInvestment() {
    investmentCounter++
    for (const inv of investments) inv.editing = false
    investments.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.investments.defaultName', { values: { index: investmentCounter } }),
      balance: undefined,
      apy: undefined,
      editing: true,
      editingName: false,
    })
  }

  function duplicateInvestment(investment: InvestmentUI) {
    investmentCounter++
    const idx = investments.indexOf(investment)
    investments.splice(idx + 1, 0, {
      ...investment,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: investment.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteInvestment(investment: InvestmentUI) {
    const idx = investments.indexOf(investment)
    if (idx !== -1) investments.splice(idx, 1)
  }

  function formatBalance(balance: number | undefined): string {
    if (balance === undefined || balance === 0) return ''
    return appStore.formatCurrency(balance)
  }

  function save() {
    const data: ProfileInvestment[] = investments
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        balance: i.balance ?? 0,
        apy: i.apy ?? 0,
      }))
    appStore.updateProfile({
      investments: data,
      has_investments: data.length > 0,
    })
  }
  // Auto-save on any edit. Skip the first post-hydration run so merely viewing the
  // page doesn't rewrite the profile (and bump "last updated") without a real change.
  let autoSaveArmed = false
  $effect(() => {
    if (!hydrated) return
    $state.snapshot(investments) // track every field so edits re-run this effect
    if (!autoSaveArmed) {
      autoSaveArmed = true
      return
    }
    untrack(save)
  })
</script>

<div class="flex w-full flex-col gap-4">
  {#each investments as investment, idx (investment.id)}
    <EditableItemCard
      item={investment}
      collapsedValue={formatBalance(investment.balance)}
      dotColor={CATEGORY_COLORS.investments[idx % CATEGORY_COLORS.investments.length]}
      onToggleEditing={() => {
        investment.editing = !investment.editing
      }}
      onDuplicate={() => duplicateInvestment(investment)}
      onDelete={() => deleteInvestment(investment)}
      onStartEditingName={() => {
        investment.editingName = true
      }}
      onStopEditingName={() => {
        investment.editingName = false
      }}
    >
      {#snippet expandedContent()}
        <div class="flex items-center gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.investments.currentBalance')}</Label>
            <SuffixedInput
              value={investment.balance}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => {
                investment.balance = v
              }}
            />
          </div>
          <div class="flex w-32 flex-col gap-2">
            <Label>{$_('page.setup.investments.apy')}</Label>
            <SuffixedInput
              value={investment.apy}
              suffix="%"
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => {
                investment.apy = v
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
    <Button variant="secondary" onclick={addInvestment}>
      <Plus class="size-4" />
      {$_('page.setup.investments.addInvestment')}
    </Button>
  </div>
</div>
