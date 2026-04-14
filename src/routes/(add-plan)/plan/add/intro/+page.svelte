<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { goto } from '$app/navigation'

  import { getNextAddPlanStepUrl } from '$lib/add-plan-steps'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  let dontShowNextTime = $state(false)

  function handleContinue() {
    if (dontShowNextTime) {
      appStore.updateProfile({ hide_plan_intro: true })
    }
    // URL is already resolved by getNextAddPlanStepUrl
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(getNextAddPlanStepUrl(routes.PLAN_ADD_INTRO, appStore.profile))
  }
</script>

<div class="flex w-full max-w-[576px] flex-col gap-8">
  <div class="flex flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold">{$_('page.addPlan.whatIsAPlan.title')}</h1>
    <p class="text-lg font-medium">{$_('page.addPlan.whatIsAPlan.description1')}</p>
    <p class="text-base">{$_('page.addPlan.whatIsAPlan.description2')}</p>
    <p class="text-base">{$_('page.addPlan.whatIsAPlan.description3')}</p>
  </div>

  <div class="flex items-center gap-2">
    <Checkbox id="dont-show" bind:checked={dontShowNextTime} />
    <Label for="dont-show" class="cursor-pointer text-sm font-medium">
      {$_('page.addPlan.dontShowNextTime')}
    </Label>
  </div>

  <div class="flex items-center justify-end gap-4">
    <Button onclick={handleContinue}>
      {$_('page.addPlan.continue')}
      <ArrowRight class="size-4" />
    </Button>
  </div>
</div>
