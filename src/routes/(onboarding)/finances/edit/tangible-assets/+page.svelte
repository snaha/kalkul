<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select'
  import { Switch } from '$lib/components/ui/switch'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import type { Frequency, TangibleAssetStatus } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { type AssetUI, onboardingDraft as draft } from '$lib/stores/onboarding-draft.svelte'
  import { notImplemented } from '$lib/utils'

  let canContinue = $derived(draft.assets.some((a) => (a.value ?? 0) > 0))

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function addAsset() {
    draft.assetCounter++
    for (const a of draft.assets) a.editing = false
    draft.assets.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.tangibleAssets.defaultName', { values: { index: draft.assetCounter } }),
      value: undefined,
      status: 'fully_owned',
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
      editing: true,
      editingName: false,
    })
  }

  function duplicateAsset(asset: AssetUI) {
    draft.assetCounter++
    const idx = draft.assets.indexOf(asset)
    draft.assets.splice(idx + 1, 0, {
      ...asset,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: asset.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteAsset(asset: AssetUI) {
    const idx = draft.assets.indexOf(asset)
    if (idx !== -1) draft.assets.splice(idx, 1)
  }

  function formatValue(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrency(val)
  }

  function frequencyLabel(f: Frequency): string {
    if (f === 'yearly') return $_('page.setup.common.yearly')
    if (f === 'weekly') return $_('page.setup.common.weekly')
    return $_('page.setup.common.monthly')
  }

  function handleContinue() {
    draft.commitAssets()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_TANGIBLE_ASSETS, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_TANGIBLE_ASSETS, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_TANGIBLE_ASSETS, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.tangibleAssets.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.tangibleAssets.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each draft.assets as asset (asset.id)}
      <EditableItemCard
        item={asset}
        collapsedValue={formatValue(asset.value)}
        dotColor={CATEGORY_COLORS.tangibleAssets[0]}
        onToggleEditing={() => {
          asset.editing = !asset.editing
        }}
        onDuplicate={() => duplicateAsset(asset)}
        onDelete={() => deleteAsset(asset)}
        onStartEditingName={() => {
          asset.editingName = true
        }}
        onStopEditingName={() => {
          asset.editingName = false
        }}
      >
        {#snippet expandedContent()}
          <div class="flex items-center gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.currentValue')}</Label>
              <SuffixedInput
                value={asset.value}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => {
                  asset.value = v
                }}
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.status')}</Label>
              <Select
                type="single"
                value={asset.status}
                onValueChange={(v) => {
                  asset.status = v as TangibleAssetStatus
                }}
              >
                <SelectTrigger class="h-8">
                  {asset.status === 'financed'
                    ? $_('page.setup.tangibleAssets.financed')
                    : $_('page.setup.tangibleAssets.fullyOwned')}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fully_owned">
                    {$_('page.setup.tangibleAssets.fullyOwned')}
                  </SelectItem>
                  <SelectItem value="financed">
                    {$_('page.setup.tangibleAssets.financed')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {#if asset.status === 'financed'}
            <div class="flex flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.outstandingBalance')}</Label>
              <SuffixedInput
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
                <Label>{$_('page.setup.tangibleAssets.installmentFrequency')}</Label>
                <Select
                  type="single"
                  value={asset.installment_frequency}
                  onValueChange={(v) => {
                    asset.installment_frequency = v as Frequency
                  }}
                >
                  <SelectTrigger class="h-8">
                    {frequencyLabel(asset.installment_frequency)}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{$_('page.setup.common.monthly')}</SelectItem>
                    <SelectItem value="yearly">{$_('page.setup.common.yearly')}</SelectItem>
                    <SelectItem value="weekly">{$_('page.setup.common.weekly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.tangibleAssets.annualRate')}</Label>
                <SuffixedInput
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
                <Label>{$_('page.setup.tangibleAssets.installmentAmount')}</Label>
                <SuffixedInput
                  value={asset.installment_amount}
                  suffix={currencyLabel}
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    asset.installment_amount = v
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.tangibleAssets.remainingTerm')}</Label>
                <SuffixedInput
                  value={asset.remaining_term}
                  suffix={$_('page.setup.tangibleAssets.years')}
                  formatNumber={appStore.formatNumber}
                  onValueChange={(v) => {
                    asset.remaining_term = v
                  }}
                />
              </div>
            </div>
          {/if}

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
      <Button variant="secondary" onclick={addAsset}>
        <Plus class="size-4" />
        {$_('page.setup.tangibleAssets.addAsset')}
      </Button>
    </div>
  </div>

  <OnboardingNav
    {canContinue}
    onBack={handleBack}
    onSkip={handleSkip}
    onContinue={handleContinue}
  />
</div>
