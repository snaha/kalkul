<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import CheckboxCard from '$lib/components/checkbox-card.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import { getNextStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  // The store is loaded before render (see +layout.ts), so the profile is
  // already populated here — seed the form state directly.
  const p = appStore.profile
  let cashAmount = $state<number | undefined>(p.cash_amount)
  let hasInvestments = $state(p.has_investments ?? false)
  let hasTangibleAssets = $state(p.has_tangible_assets ?? false)
  let hasLiabilities = $state(p.has_liabilities ?? false)

  function saveData() {
    appStore.updateProfile({
      cash_amount: cashAmount,
      has_investments: hasInvestments,
      has_tangible_assets: hasTangibleAssets,
      has_liabilities: hasLiabilities,
    })
  }

  function handleContinue() {
    saveData()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT, appStore.profile))
  }

  function handleBack() {
    goto(resolve(routes.PROFILE))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-xl font-bold leading-7">
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
      suffix={appStore.profile.currencyOrDefault}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => {
        cashAmount = v
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

  <OnboardingNav onBack={handleBack} onContinue={handleContinue} />
</div>
