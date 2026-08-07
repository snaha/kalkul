<script lang="ts">
  import { onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Plus from '@lucide/svelte/icons/plus'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import EditorItemErrors from '$lib/components/editor-item-errors.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { createListEditor } from '$lib/list-editor.svelte'
  import type { ProfileInvestment } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface InvestmentUI {
    id: string
    name: string
    balance: number | undefined
    apy: number | undefined
    editing: boolean
  }

  interface Props {
    onHasValueChange?: (hasValue: boolean) => void
  }

  let { onHasValueChange }: Props = $props()

  const editor = createListEditor<ProfileInvestment, InvestmentUI>({
    load: () => appStore.profile.investments,
    toUI: (inv) => ({
      id: inv.id,
      name: inv.name,
      balance: inv.balance > 0 ? inv.balance : undefined,
      apy: inv.apy > 0 ? inv.apy : undefined,
      editing: false,
    }),
    makeBlank: (index) => ({
      id: crypto.randomUUID(),
      name: $_('page.setup.investments.defaultName', { values: { index } }),
      balance: undefined,
      apy: undefined,
      editing: true,
    }),
    copyName: (name) => $_('page.setup.common.copySuffix', { values: { name } }),
    hasValue: (i) => (i.balance ?? 0) > 0,
    toStored: (i) => ({
      id: i.id,
      name: i.name,
      balance: i.balance ?? 0,
      apy: i.apy ?? 0,
    }),
    persist: (data) =>
      appStore.updateProfile({
        investments: data,
        has_investments: data.length > 0,
      }),
  })
  onDestroy(editor.flushSave)

  $effect(() => {
    onHasValueChange?.(editor.hasAnyValue)
  })

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function formatBalance(balance: number | undefined): string {
    if (balance === undefined || balance === 0) return ''
    return appStore.formatCurrency(balance)
  }
</script>

<div class="flex w-full flex-col gap-4">
  {#each editor.items as investment, idx (investment.id)}
    <div class="flex flex-col gap-1">
      <EditableItemCard
        item={investment}
        collapsedValue={formatBalance(investment.balance)}
        dotColor={CATEGORY_COLORS.investments[idx % CATEGORY_COLORS.investments.length]}
        onToggleEditing={() => {
          investment.editing = !investment.editing
        }}
        onDuplicate={() => editor.duplicate(investment)}
        onDelete={() => editor.remove(investment)}
      >
        {#snippet expandedContent()}
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label for="currentBalance-{investment.id}"
                >{$_('page.setup.investments.currentBalance')}</Label
              >
              <SuffixedInput
                id="currentBalance-{investment.id}"
                value={investment.balance}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  investment.balance = v
                }}
              />
            </div>
            <div class="flex w-32 flex-col gap-2">
              <Label for="apy-{investment.id}">{$_('page.setup.investments.apy')}</Label>
              <SuffixedInput
                id="apy-{investment.id}"
                value={investment.apy}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  investment.apy = v
                }}
              />
            </div>
          </div>
        {/snippet}
      </EditableItemCard>
      <EditorItemErrors messages={editor.errors[investment.id]} />
    </div>
  {/each}

  <div>
    <Button variant="secondary" onclick={editor.add}>
      <Plus class="size-4" />
      {$_('page.setup.investments.addInvestment')}
    </Button>
  </div>
</div>
