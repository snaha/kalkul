<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { X } from '@lucide/svelte'

  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import LeaveConfirmDialog from '$lib/components/leave-confirm-dialog.svelte'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Progress } from '$lib/components/ui/progress'
  import { getOnboardingSteps } from '$lib/onboarding-steps'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { leaveGuard } from '$lib/stores/leave-guard.svelte'
  import { onboardingDraft } from '$lib/stores/onboarding-draft.svelte'

  let { children } = $props()

  // This layout stays mounted for the whole flow, so it owns the draft lifecycle:
  // seed a fresh draft from the profile once data has loaded. In-flow navigation
  // keeps the layout mounted, so the user's entries survive Back/Continue; leaving
  // and re-entering re-mounts the layout and re-seeds from the profile.
  let seeded = $state(false)
  $effect(() => {
    if (seeded || appStore.loading) return
    onboardingDraft.reset()
    seeded = true
  })

  // Warn before abandoning setup (via the X or browser back) once the draft has
  // unsaved changes. The flow's own Continue/Back/Skip use goto() and are never
  // intercepted.
  leaveGuard.guard('(onboarding)')
  leaveGuard.setDirtyCheck(() => seeded && onboardingDraft.dirty)

  const steps = $derived(getOnboardingSteps(appStore.profile))
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
        {$_('page.setup.title')}
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
