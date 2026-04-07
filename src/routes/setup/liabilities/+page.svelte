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
  import type { ProfileLiability } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface LiabilityUI {
    id: string
    name: string
    outstandingBalance: string
    installmentFrequency: string
    annualRate: string
    installmentAmount: string
    remainingTerm: string
    editing: boolean
    editingName: boolean
    showAdvanced: boolean
  }

  function storedToUI(stored: ProfileLiability[]): LiabilityUI[] {
    return stored.map((l) => ({
      id: l.id,
      name: l.name,
      outstandingBalance: l.outstanding_balance > 0 ? String(l.outstanding_balance) : '',
      installmentFrequency: l.installment_frequency,
      annualRate: l.annual_rate > 0 ? String(l.annual_rate) : '',
      installmentAmount: l.installment_amount > 0 ? String(l.installment_amount) : '',
      remainingTerm: l.remaining_term > 0 ? String(l.remaining_term) : '',
      editing: false,
      editingName: false,
      showAdvanced: false,
    }))
  }

  let liabilities = $state<LiabilityUI[]>([])
  let liabilityCounter = $state(0)
  let loaded = $state(false)

  $effect(() => {
    const stored = appStore.profile.liabilities
    if (!loaded && stored && stored.length > 0) {
      liabilities = storedToUI(stored)
      liabilityCounter = liabilities.length
      loaded = true
    }
  })

  let canContinue = $derived(
    liabilities.some(
      (l) => l.outstandingBalance.trim().length > 0 && Number(l.outstandingBalance) > 0,
    ),
  )

  let currencyLabel = $derived(appStore.profile.currency || 'EUR')

  function addLiability() {
    liabilityCounter++
    for (const l of liabilities) l.editing = false
    liabilities.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.liabilities.defaultName', { values: { index: liabilityCounter } }),
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

  function duplicateLiability(liability: LiabilityUI) {
    liabilityCounter++
    const idx = liabilities.indexOf(liability)
    const copy: LiabilityUI = {
      ...liability,
      id: crypto.randomUUID(),
      name: `${liability.name} (copy)`,
      editing: true,
      editingName: false,
    }
    liabilities.splice(idx + 1, 0, copy)
  }

  function deleteLiability(liability: LiabilityUI) {
    const idx = liabilities.indexOf(liability)
    if (idx !== -1) liabilities.splice(idx, 1)
  }

  function formatBalance(val: string): string {
    const num = Number(val)
    if (isNaN(num) || num === 0) return ''
    return `${num.toLocaleString()} ${currencyLabel}`
  }

  function saveLiabilities() {
    const data: ProfileLiability[] = liabilities
      .filter((l) => l.name.trim().length > 0)
      .map((l) => ({
        id: l.id,
        name: l.name,
        outstanding_balance: Number(l.outstandingBalance) || 0,
        installment_frequency: l.installmentFrequency,
        annual_rate: Number(l.annualRate) || 0,
        installment_amount: Number(l.installmentAmount) || 0,
        remaining_term: Number(l.remainingTerm) || 0,
      }))
    appStore.updateProfile({ liabilities: data })
  }

  function handleContinue() {
    saveLiabilities()
    goto(resolve(routes.SETUP_INCOME))
  }

  function handleSkip() {
    goto(resolve(routes.SETUP_INCOME))
  }

  function handleBack() {
    if (appStore.profile.has_tangible_assets) return goto(resolve(routes.SETUP_TANGIBLE_ASSETS))
    if (appStore.profile.has_investments) return goto(resolve(routes.SETUP_INVESTMENTS))
    goto(resolve(routes.SETUP_FINANCES))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.liabilities.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.liabilities.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each liabilities as liability (liability.id)}
      <Card>
        <CardContent class="flex flex-col gap-4 p-4">
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onclick={() => {
                liability.editing = !liability.editing
              }}
            >
              <ChevronsUpDown class="size-4" />
            </Button>
            <div class="size-4 shrink-0 rounded-xs bg-chart-1"></div>

            {#if liability.editingName}
              <Input
                class="h-8 flex-1"
                value={liability.name}
                oninput={(e) => {
                  liability.name = (e.currentTarget as HTMLInputElement).value
                }}
                onblur={() => {
                  liability.editingName = false
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') liability.editingName = false
                }}
              />
            {:else}
              <span class="flex-1 truncate text-base font-medium">{liability.name}</span>
            {/if}

            {#if liability.editing}
              <Button
                variant="ghost"
                size="icon"
                onclick={() => {
                  liability.editingName = true
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
                  <DropdownMenuItem onclick={() => duplicateLiability(liability)}>
                    {$_('page.setup.common.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onclick={() => deleteLiability(liability)}>
                    {$_('page.setup.common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            {:else}
              <span class="shrink-0 text-sm text-foreground">
                {formatBalance(liability.outstandingBalance)}
              </span>
            {/if}
          </div>

          {#if liability.editing}
            <div class="flex flex-col gap-2">
              <Label>{$_('page.setup.liabilities.outstandingBalance')}</Label>
              <SuffixedInput
                value={liability.outstandingBalance}
                suffix={currencyLabel}
                oninput={(e) => {
                  liability.outstandingBalance = (e.currentTarget as HTMLInputElement).value
                }}
              />
            </div>

            <div class="flex items-center gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.liabilities.installmentFrequency')}</Label>
                <Select
                  type="single"
                  value={liability.installmentFrequency}
                  onValueChange={(v) => {
                    liability.installmentFrequency = v
                  }}
                >
                  <SelectTrigger class="h-8">
                    {liability.installmentFrequency === 'yearly'
                      ? $_('page.setup.common.yearly')
                      : liability.installmentFrequency === 'weekly'
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
                <Label>{$_('page.setup.liabilities.annualRate')}</Label>
                <SuffixedInput
                  value={liability.annualRate}
                  suffix="%"
                  oninput={(e) => {
                    liability.annualRate = (e.currentTarget as HTMLInputElement).value
                  }}
                />
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.liabilities.installmentAmount')}</Label>
                <SuffixedInput
                  value={liability.installmentAmount}
                  suffix={currencyLabel}
                  oninput={(e) => {
                    liability.installmentAmount = (e.currentTarget as HTMLInputElement).value
                  }}
                />
              </div>
              <div class="flex flex-1 flex-col gap-2">
                <Label>{$_('page.setup.liabilities.remainingTerm')}</Label>
                <SuffixedInput
                  value={liability.remainingTerm}
                  suffix={$_('page.setup.liabilities.years')}
                  oninput={(e) => {
                    liability.remainingTerm = (e.currentTarget as HTMLInputElement).value
                  }}
                />
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Switch
                checked={liability.showAdvanced}
                onCheckedChange={(v) => {
                  liability.showAdvanced = v === true
                }}
              />
              <span class="text-sm font-medium">{$_('page.setup.common.advancedOptions')}</span>
            </div>
          {/if}
        </CardContent>
      </Card>
    {/each}

    <div>
      <Button variant="secondary" onclick={addLiability}>
        <Plus class="size-4" />
        {$_('page.setup.liabilities.addLiability')}
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
