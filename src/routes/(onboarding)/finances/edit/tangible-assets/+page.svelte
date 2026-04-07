<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight, ChevronsUpDown, EllipsisVertical, Plus, SquarePen } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent } from '$lib/components/ui/card'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select'
  import { Switch } from '$lib/components/ui/switch'
  import routes from '$lib/routes'
  import type { ProfileTangibleAsset } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface AssetUI {
    id: string
    name: string
    value: string
    status: string
    outstandingBalance: string
    installmentFrequency: string
    annualRate: string
    installmentAmount: string
    remainingTerm: string
    editing: boolean
    editingName: boolean
    showAdvanced: boolean
  }

  function storedToUI(stored: ProfileTangibleAsset[]): AssetUI[] {
    return stored.map((a) => ({
      id: a.id,
      name: a.name,
      value: a.value > 0 ? String(a.value) : '',
      status: a.status,
      outstandingBalance:
        a.outstanding_balance !== undefined && a.outstanding_balance > 0
          ? String(a.outstanding_balance)
          : '',
      installmentFrequency: a.installment_frequency ?? 'monthly',
      annualRate: a.annual_rate !== undefined && a.annual_rate > 0 ? String(a.annual_rate) : '',
      installmentAmount:
        a.installment_amount !== undefined && a.installment_amount > 0
          ? String(a.installment_amount)
          : '',
      remainingTerm:
        a.remaining_term !== undefined && a.remaining_term > 0 ? String(a.remaining_term) : '',
      editing: false,
      editingName: false,
      showAdvanced: false,
    }))
  }

  let assets = $state<AssetUI[]>([])
  let assetCounter = $state(0)
  let loaded = $state(false)

  $effect(() => {
    const stored = appStore.profile.tangible_assets
    if (!loaded && stored && stored.length > 0) {
      assets = storedToUI(stored)
      assetCounter = assets.length
      loaded = true
    }
  })

  let canContinue = $derived(assets.some((a) => a.value.trim().length > 0 && Number(a.value) > 0))

  let currencyLabel = $derived(appStore.profile.currency || 'EUR')

  function addAsset() {
    assetCounter++
    for (const a of assets) a.editing = false
    assets.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.tangibleAssets.defaultName', { values: { index: assetCounter } }),
      value: '',
      status: 'fully_owned',
      outstandingBalance: '',
      installmentFrequency: 'monthly',
      annualRate: '',
      installmentAmount: '',
      remainingTerm: '',
      editing: true,
      editingName: false,
      showAdvanced: false,
    })
  }

  function duplicateAsset(asset: AssetUI) {
    assetCounter++
    const idx = assets.indexOf(asset)
    const copy: AssetUI = {
      ...asset,
      id: crypto.randomUUID(),
      name: `${asset.name} (copy)`,
      editing: true,
      editingName: false,
    }
    assets.splice(idx + 1, 0, copy)
  }

  function deleteAsset(asset: AssetUI) {
    const idx = assets.indexOf(asset)
    if (idx !== -1) assets.splice(idx, 1)
  }

  function formatValue(val: string): string {
    const num = Number(val)
    if (isNaN(num) || num === 0) return ''
    return `${num.toLocaleString()} ${currencyLabel}`
  }

  function saveAssets() {
    const data: ProfileTangibleAsset[] = assets
      .filter((a) => a.name.trim().length > 0)
      .map((a) => ({
        id: a.id,
        name: a.name,
        value: Number(a.value) || 0,
        status: a.status,
        outstanding_balance:
          a.status === 'financed' ? Number(a.outstandingBalance) || 0 : undefined,
        installment_frequency: a.status === 'financed' ? a.installmentFrequency : undefined,
        annual_rate: a.status === 'financed' ? Number(a.annualRate) || 0 : undefined,
        installment_amount: a.status === 'financed' ? Number(a.installmentAmount) || 0 : undefined,
        remaining_term: a.status === 'financed' ? Number(a.remainingTerm) || 0 : undefined,
      }))
    appStore.updateProfile({ tangible_assets: data })
  }

  function nextStep() {
    if (appStore.profile.has_liabilities) return routes.FINANCES_EDIT_LIABILITIES
    return routes.FINANCES_EDIT_INCOME
  }

  function handleContinue() {
    saveAssets()
    goto(resolve(nextStep()))
  }

  function handleSkip() {
    goto(resolve(nextStep()))
  }

  function handleBack() {
    if (appStore.profile.has_investments) return goto(resolve(routes.FINANCES_EDIT_INVESTMENTS))
    goto(resolve(routes.FINANCES_EDIT))
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
      <Card>
        <CardContent class="flex flex-col gap-4 p-4">
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onclick={() => {
                asset.editing = !asset.editing
              }}
            >
              <ChevronsUpDown class="size-4" />
            </Button>
            <div class="size-4 shrink-0 rounded-xs bg-chart-3"></div>

            {#if asset.editingName}
              <Input
                class="h-8 flex-1"
                value={asset.name}
                oninput={(e) => {
                  asset.name = (e.currentTarget as HTMLInputElement).value
                }}
                onblur={() => {
                  asset.editingName = false
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') asset.editingName = false
                }}
              />
            {:else}
              <span class="flex-1 truncate text-base font-medium">{asset.name}</span>
            {/if}

            {#if asset.editing}
              <Button
                variant="ghost"
                size="icon"
                onclick={() => {
                  asset.editingName = true
                }}
              >
                <SquarePen class="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  {#snippet child({ props })}
                    <Button variant="ghost" size="icon" {...props}>
                      <EllipsisVertical class="size-4" />
                    </Button>
                  {/snippet}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onclick={() => duplicateAsset(asset)}>
                    {$_('page.setup.common.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onclick={() => deleteAsset(asset)}>
                    {$_('page.setup.common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            {:else}
              <span class="shrink-0 text-sm text-foreground">{formatValue(asset.value)}</span>
            {/if}
          </div>

          {#if asset.editing}
            <div class="flex items-center gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.tangibleAssets.currentValue')}</Label>
                <SuffixedInput
                  value={asset.value}
                  suffix={currencyLabel}
                  oninput={(e) => {
                    asset.value = (e.currentTarget as HTMLInputElement).value
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.tangibleAssets.status')}</Label>
                <Select
                  type="single"
                  value={asset.status}
                  onValueChange={(v) => {
                    asset.status = v
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
                  value={asset.outstandingBalance}
                  suffix={currencyLabel}
                  oninput={(e) => {
                    asset.outstandingBalance = (e.currentTarget as HTMLInputElement).value
                  }}
                />
              </div>
              <div class="flex items-center gap-2">
                <div class="flex flex-1 flex-col gap-2">
                  <Label>{$_('page.setup.tangibleAssets.installmentFrequency')}</Label>
                  <Select
                    type="single"
                    value={asset.installmentFrequency}
                    onValueChange={(v) => {
                      asset.installmentFrequency = v
                    }}
                  >
                    <SelectTrigger class="h-8">
                      {asset.installmentFrequency === 'yearly'
                        ? $_('page.setup.common.yearly')
                        : asset.installmentFrequency === 'weekly'
                          ? $_('page.setup.common.weekly')
                          : $_('page.setup.common.monthly')}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{$_('page.setup.common.monthly')}</SelectItem>
                      <SelectItem value="yearly">{$_('page.setup.common.yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-1 flex-col gap-2">
                  <Label>{$_('page.setup.tangibleAssets.annualRate')}</Label>
                  <SuffixedInput
                    value={asset.annualRate}
                    suffix="%"
                    oninput={(e) => {
                      asset.annualRate = (e.currentTarget as HTMLInputElement).value
                    }}
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex flex-1 flex-col gap-2">
                  <Label>{$_('page.setup.tangibleAssets.installmentAmount')}</Label>
                  <SuffixedInput
                    value={asset.installmentAmount}
                    suffix={currencyLabel}
                    oninput={(e) => {
                      asset.installmentAmount = (e.currentTarget as HTMLInputElement).value
                    }}
                  />
                </div>
                <div class="flex flex-1 flex-col gap-2">
                  <Label>{$_('page.setup.tangibleAssets.remainingTerm')}</Label>
                  <SuffixedInput
                    value={asset.remainingTerm}
                    suffix={$_('page.setup.tangibleAssets.years')}
                    oninput={(e) => {
                      asset.remainingTerm = (e.currentTarget as HTMLInputElement).value
                    }}
                  />
                </div>
              </div>
            {/if}

            <div class="flex items-center gap-2">
              <Switch
                checked={asset.showAdvanced}
                onCheckedChange={(v) => {
                  asset.showAdvanced = v === true
                }}
              />
              <span class="text-sm font-medium">{$_('page.setup.common.advancedOptions')}</span>
            </div>
          {/if}
        </CardContent>
      </Card>
    {/each}

    <div>
      <Button variant="secondary" onclick={addAsset}>
        <Plus class="size-4" />
        {$_('page.setup.tangibleAssets.addAsset')}
      </Button>
    </div>
  </div>

  <div class="flex w-full items-center gap-4">
    <Button variant="ghost" onclick={handleBack}>
      {$_('page.setup.back')}
    </Button>
    <div class="flex flex-1 items-center justify-end gap-2">
      <Button variant="ghost" onclick={handleSkip}>
        {$_('page.setup.skip')}
      </Button>
      <Button disabled={!canContinue} onclick={handleContinue}>
        {$_('page.setup.continue')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
