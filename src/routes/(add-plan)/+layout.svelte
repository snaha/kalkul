<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { X } from '@lucide/svelte'

  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import { getAddPlanSteps } from '$lib/add-plan-steps'
  import LeaveConfirmDialog from '$lib/components/leave-confirm-dialog.svelte'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Progress } from '$lib/components/ui/progress'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { leaveGuard } from '$lib/stores/leave-guard.svelte'
  import { planDraftStore } from '$lib/stores/plan-draft.svelte'

  let { children } = $props()

  // This layout stays mounted for the whole add-plan flow, so it owns the draft
  // lifecycle: seed a fresh draft when the flow is entered. In-flow navigation
  // between steps keeps the layout mounted, so the user's entries are preserved;
  // leaving and re-entering re-mounts the layout and starts clean.
  planDraftStore.reset(appStore.profile, appStore.portfolios.length)

  // Warn before abandoning the flow (via the X or browser back) once the draft
  // has diverged from its defaults. Creating the plan navigates with goto(), so
  // it is never intercepted.
  leaveGuard.guard('(add-plan)')
  leaveGuard.setDirtyCheck(() => planDraftStore.dirty)

  const steps = $derived(getAddPlanSteps(appStore.profile))
  const totalSteps = $derived(steps.length)

  let currentStepIndex = $derived.by(() => {
    const pathname = page.url.pathname.replace(/\/$/, '')
    const idx = steps.findIndex((s) => pathname === s)
    return Math.max(0, idx)
  })

  let progressValue = $derived(Math.round(((currentStepIndex + 1) / totalSteps) * 100))
</script>

<div class="flex min-h-screen flex-col bg-background">
  <header class="flex items-center gap-4 overflow-clip p-8">
    <div class="flex flex-1 items-center gap-4">
      <span class="text-base font-medium text-foreground">
        {$_('page.addPlan.title')}
      </span>
      <Progress value={progressValue} max={100} class="max-w-32" />
    </div>
    <ThemeSwitcher />
    <Button variant="ghost" size="icon" href={resolve(routes.HOME)}>
      <X class="size-4" />
    </Button>
  </header>
  <main class="flex flex-1 flex-col items-center p-8">
    {@render children()}
  </main>
</div>

<LeaveConfirmDialog />
