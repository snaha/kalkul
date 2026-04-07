<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import CheckboxCard from '$lib/components/checkbox-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
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
    <SuffixedInput
      id="setup-cash"
      value={cashAmount}
      suffix={appStore.profile.currency || 'EUR'}
      oninput={(e) => {
        cashAmount = (e.currentTarget as HTMLInputElement).value
      }}
    />
    <p class="text-sm text-muted-foreground">
      {$_('page.setup.finances.cashDescription')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-2">
    <p class="text-sm font-medium text-foreground">
      {$_('page.setup.finances.whichDoYouHave')}
    </p>

    <CheckboxCard
      checked={hasInvestments}
      onCheckedChange={(v) => {
        hasInvestments = v
      }}
      title={$_('page.setup.finances.investments')}
      description={$_('page.setup.finances.investmentsDescription')}
    />

    <CheckboxCard
      checked={hasTangibleAssets}
      onCheckedChange={(v) => {
        hasTangibleAssets = v
      }}
      title={$_('page.setup.finances.tangibleAssets')}
      description={$_('page.setup.finances.tangibleAssetsDescription')}
    />

    <CheckboxCard
      checked={hasLiabilities}
      onCheckedChange={(v) => {
        hasLiabilities = v
      }}
      title={$_('page.setup.finances.liabilities')}
      description={$_('page.setup.finances.liabilitiesDescription')}
    />
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
