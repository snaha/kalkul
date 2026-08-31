<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'

  import InvestmentsEditor from '$lib/components/investments-editor.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  function handleContinue() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_INVESTMENTS, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_INVESTMENTS, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-xl font-bold leading-7">
      {$_('page.setup.investments.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.investments.description')}
    </p>
  </div>

  <InvestmentsEditor />

  <OnboardingNav onBack={handleBack} onContinue={handleContinue} />
</div>
