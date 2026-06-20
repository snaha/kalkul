<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'

  import ExpensesEditor from '$lib/components/expenses-editor.svelte'
  import OnboardingNav from '$lib/components/onboarding-nav.svelte'
  import { getNextStepUrl, getPrevStepUrl } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  let hasValue = $state(false)

  function handleContinue() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_EXPENSES, appStore.profile))
  }

  function handleSkip() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextStepUrl(routes.FINANCES_EDIT_EXPENSES, appStore.profile))
  }

  function handleBack() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getPrevStepUrl(routes.FINANCES_EDIT_EXPENSES, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.expenses.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.expenses.description')}
    </p>
  </div>

  <ExpensesEditor onHasValueChange={(v) => (hasValue = v)} />

  <OnboardingNav
    canContinue={hasValue}
    onBack={handleBack}
    onSkip={handleSkip}
    onContinue={handleContinue}
  />
</div>
