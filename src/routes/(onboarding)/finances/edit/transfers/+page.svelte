<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'

  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import TransfersEditor from '$lib/components/transfers-editor.svelte'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  function handleFinish() {
    // Transfers is the final onboarding step; the next step is the home page.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_TRANSFERS, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_TRANSFERS, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-xl font-bold leading-7">
      {$_('page.setup.transfers.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.transfers.description')}
    </p>
  </div>

  <TransfersEditor />

  <OnboardingNav done onBack={handleBack} onContinue={handleFinish} />
</div>
