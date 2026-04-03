<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  let cashAmount = $state('')
  let hasInvestments = $state(false)
  let hasTangibleAssets = $state(false)
  let hasLiabilities = $state(false)

  $effect(() => {
    const p = appStore.profile
    if (p.cash_amount !== undefined && !cashAmount) cashAmount = String(p.cash_amount)
    if (p.has_investments) hasInvestments = p.has_investments
    if (p.has_tangible_assets) hasTangibleAssets = p.has_tangible_assets
    if (p.has_liabilities) hasLiabilities = p.has_liabilities
  })

  let canContinue = $derived(
    cashAmount.trim().length > 0 || hasInvestments || hasTangibleAssets || hasLiabilities,
  )

  function saveData() {
    const amount = Number(cashAmount)
    appStore.updateProfile({
      cash_amount: isNaN(amount) ? undefined : amount,
      has_investments: hasInvestments,
      has_tangible_assets: hasTangibleAssets,
      has_liabilities: hasLiabilities,
    })
  }

  function handleContinue() {
    saveData()
    goto(resolve(routes.SETUP_INCOME))
  }

  function handleSkip() {
    goto(resolve(routes.SETUP_INCOME))
  }

  function handleBack() {
    goto(resolve(routes.SETUP))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.finances.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.finances.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-2">
    <Label for="setup-cash">{$_('page.setup.finances.cashLabel')}</Label>
    <div class="relative">
      <Input id="setup-cash" placeholder="0" bind:value={cashAmount} class="pr-14" />
      <span
        class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm font-medium text-muted-foreground"
      >
        {appStore.profile.currency || 'EUR'}
      </span>
    </div>
    <p class="text-sm text-muted-foreground">
      {$_('page.setup.finances.cashDescription')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-2">
    <p class="text-sm font-medium text-foreground">
      {$_('page.setup.finances.whichDoYouHave')}
    </p>

    <label
      class="flex w-full cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-left transition-colors has-[[data-state=checked]]:bg-[rgba(23,23,23,0.05)] dark:has-[[data-state=checked]]:bg-[rgba(255,255,255,0.1)]"
    >
      <Checkbox bind:checked={hasInvestments} />
      <div class="flex flex-col gap-1.5 text-sm">
        <span class="font-medium leading-none text-foreground">
          {$_('page.setup.finances.investments')}
        </span>
        <span class="leading-5 text-muted-foreground">
          {$_('page.setup.finances.investmentsDescription')}
        </span>
      </div>
    </label>

    <label
      class="flex w-full cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-left transition-colors has-[[data-state=checked]]:bg-[rgba(23,23,23,0.05)] dark:has-[[data-state=checked]]:bg-[rgba(255,255,255,0.1)]"
    >
      <Checkbox bind:checked={hasTangibleAssets} />
      <div class="flex flex-col gap-1.5 text-sm">
        <span class="font-medium leading-none text-foreground">
          {$_('page.setup.finances.tangibleAssets')}
        </span>
        <span class="leading-5 text-muted-foreground">
          {$_('page.setup.finances.tangibleAssetsDescription')}
        </span>
      </div>
    </label>

    <label
      class="flex w-full cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-left transition-colors has-[[data-state=checked]]:bg-[rgba(23,23,23,0.05)] dark:has-[[data-state=checked]]:bg-[rgba(255,255,255,0.1)]"
    >
      <Checkbox bind:checked={hasLiabilities} />
      <div class="flex flex-col gap-1.5 text-sm">
        <span class="font-medium leading-none text-foreground">
          {$_('page.setup.finances.liabilities')}
        </span>
        <span class="leading-5 text-muted-foreground">
          {$_('page.setup.finances.liabilitiesDescription')}
        </span>
      </div>
    </label>
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
