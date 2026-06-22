<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import CheckboxCard from '$lib/components/checkbox-card.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { getNextStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { onboardingDraft as draft } from '$lib/stores/onboarding-draft.svelte'

  let canContinue = $derived(
    (draft.cashAmount ?? 0) > 0 ||
      draft.hasInvestments ||
      draft.hasTangibleAssets ||
      draft.hasLiabilities,
  )

  function handleContinue() {
    draft.commitOverview()
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT, appStore.profile))
  }

  function handleBack() {
    goto(resolve(routes.PROFILE))
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
      value={draft.cashAmount}
      suffix={appStore.profile.currencyOrDefault}
      formatNumber={appStore.formatNumber}
      onValueChange={(v) => {
        draft.cashAmount = v
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
      checked={draft.hasInvestments}
      onCheckedChange={(v) => {
        draft.hasInvestments = v
      }}
      title={$_('page.setup.finances.investments')}
      description={$_('page.setup.finances.investmentsDescription')}
    />

    <CheckboxCard
      checked={draft.hasTangibleAssets}
      onCheckedChange={(v) => {
        draft.hasTangibleAssets = v
      }}
      title={$_('page.setup.finances.tangibleAssets')}
      description={$_('page.setup.finances.tangibleAssetsDescription')}
    />

    <CheckboxCard
      checked={draft.hasLiabilities}
      onCheckedChange={(v) => {
        draft.hasLiabilities = v
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
