<script lang="ts">
  import { _ } from 'svelte-i18n'

  import X from '@lucide/svelte/icons/x'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { Textarea } from '$lib/components/ui/textarea'
  import { buildPlanInclusions, getDefaultPlanDates, getDefaultPlanName } from '$lib/plan-defaults'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

  let { open = $bindable(), onOpenChange }: Props = $props()

  const uid = $props.id()

  function defaultName(): string {
    return getDefaultPlanName(
      appStore.portfolios.map((p) => p.name),
      (index) => $_('page.addProjection.defaultName', { values: { index } }),
    )
  }

  // Initial value only matters before the first open — the $effect below
  // re-seeds the form every time the dialog opens.
  let name = $state(defaultName())
  let notes = $state('')
  let startFromCurrentFinances = $state(true)

  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      name = defaultName()
      notes = ''
      startFromCurrentFinances = true
    }
    wasOpen = open
  })

  function close() {
    onOpenChange(false)
  }

  function handleCreate() {
    const id = appStore.addPortfolio({
      name: name.trim(),
      notes: notes.trim() || undefined,
      ...getDefaultPlanDates(appStore.profile),
      ...buildPlanInclusions(appStore.profile, startFromCurrentFinances),
    })
    close()
    goto(resolve(`${routes.PLAN_VIEW}/${id}`))
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center border-b p-4">
      <Dialog.Title class="flex-1 text-base font-medium">
        {$_('page.addProjection.title')}
      </Dialog.Title>
      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-4 p-4">
      <div class="flex flex-col gap-2">
        <Label for="{uid}-name">{$_('page.addProjection.name')}</Label>
        <Input id="{uid}-name" bind:value={name} />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="{uid}-notes">{$_('page.addProjection.exploring')}</Label>
        <Textarea
          id="{uid}-notes"
          bind:value={notes}
          placeholder={$_('page.addProjection.exploringPlaceholder')}
          class="min-h-16"
        />
      </div>

      <div class="flex items-center gap-2">
        <label class="flex flex-1 cursor-pointer items-center gap-2">
          <Switch
            checked={startFromCurrentFinances}
            onCheckedChange={(v) => (startFromCurrentFinances = v === true)}
          />
          <span class="text-sm font-medium">
            {$_('page.addProjection.startFromCurrentFinances')}
          </span>
        </label>
        <HelpTooltip text={$_('page.addProjection.startFromCurrentFinancesHelp')} />
      </div>
    </div>

    <Dialog.Footer class="flex flex-row bg-muted p-4 sm:justify-start">
      <Button onclick={handleCreate} disabled={name.trim().length === 0}>
        {$_('page.addProjection.create')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
