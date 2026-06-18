<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Plus } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import EditableItemCard from '$lib/components/editable-item-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import SelectField from '$lib/components/select-field.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import type { Frequency, ProfileTangibleAsset, TangibleAssetStatus } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { notImplemented } from '$lib/utils'

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
    editing: boolean
    editingName: boolean
  }

  function storedToUI(stored: ProfileTangibleAsset[]): AssetUI[] {
    return stored.map((a) => ({
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
      editing: false,
      editingName: false,
    }))
  }

  let assets = $state<AssetUI[]>([])
  let assetCounter = $state(0)
  let hydrated = $state(false)

  $effect(() => {
    if (hydrated || appStore.loading) return
    const stored = appStore.profile.tangible_assets
    if (stored && stored.length > 0) {
      assets = storedToUI(stored)
      assetCounter = assets.length
    }
    hydrated = true
  })

  let canContinue = $derived(assets.some((a) => (a.value ?? 0) > 0))

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  let statusItems = $derived([
    { value: 'fully_owned', label: $_('page.setup.tangibleAssets.fullyOwned') },
    { value: 'financed', label: $_('page.setup.tangibleAssets.financed') },
  ])

  let frequencyItems = $derived([
    { value: 'monthly', label: $_('page.setup.common.monthly') },
    { value: 'yearly', label: $_('page.setup.common.yearly') },
    { value: 'weekly', label: $_('page.setup.common.weekly') },
  ])

  function addAsset() {
    assetCounter++
    for (const a of assets) a.editing = false
    assets.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.tangibleAssets.defaultName', { values: { index: assetCounter } }),
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
    assetCounter++
    const idx = assets.indexOf(asset)
    assets.splice(idx + 1, 0, {
      ...asset,
      id: crypto.randomUUID(),
      name: $_('page.setup.common.copySuffix', { values: { name: asset.name } }),
      editing: true,
      editingName: false,
    })
  }

  function deleteAsset(asset: AssetUI) {
    const idx = assets.indexOf(asset)
    if (idx !== -1) assets.splice(idx, 1)
  }

  function formatValue(val: number | undefined): string {
    if (val === undefined || val === 0) return ''
    return appStore.formatCurrency(val)
  }

  function saveAssets() {
    const data: ProfileTangibleAsset[] = assets
      .filter((a) => a.name.trim().length > 0)
      .map((a) => ({
        id: a.id,
        name: a.name,
        value: a.value ?? 0,
        status: a.status,
        outstanding_balance: a.status === 'financed' ? (a.outstanding_balance ?? 0) : undefined,
        installment_frequency: a.status === 'financed' ? a.installment_frequency : undefined,
        annual_rate: a.status === 'financed' ? (a.annual_rate ?? 0) : undefined,
        installment_amount: a.status === 'financed' ? (a.installment_amount ?? 0) : undefined,
        remaining_term: a.status === 'financed' ? (a.remaining_term ?? 0) : undefined,
      }))
    appStore.updateProfile({
      tangible_assets: data,
      has_tangible_assets: data.length > 0,
    })
  }

  function handleContinue() {
    saveAssets()
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
    {#each assets as asset (asset.id)}
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
              <SelectField
                value={asset.status}
                items={statusItems}
                onValueChange={(v) => {
                  asset.status = v as TangibleAssetStatus
                }}
              />
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
                <SelectField
                  value={asset.installment_frequency}
                  items={frequencyItems}
                  onValueChange={(v) => {
                    asset.installment_frequency = v as Frequency
                  }}
                />
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
