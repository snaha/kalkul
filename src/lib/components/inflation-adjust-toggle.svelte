<script lang="ts">
  import { _ } from 'svelte-i18n'

  import CircleHelp from '@lucide/svelte/icons/circle-help'

  import { Switch } from '$lib/components/ui/switch'
  import * as Tooltip from '$lib/components/ui/tooltip'

  interface Props {
    checked: boolean
    onCheckedChange: (v: boolean) => void
  }

  let { checked, onCheckedChange }: Props = $props()

  let tooltipOpen = $state(false)
</script>

<div class="flex items-center gap-2">
  <label class="flex cursor-pointer items-center gap-2">
    <Switch {checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
    <span class="text-sm font-medium">{$_('page.plan.adjustForInflation')}</span>
  </label>
  <Tooltip.Provider delayDuration={150}>
    <Tooltip.Root bind:open={tooltipOpen} disableCloseOnTriggerClick>
      <Tooltip.Trigger
        type="button"
        aria-label={$_('page.plan.adjustForInflationDescription')}
        onclick={() => (tooltipOpen = !tooltipOpen)}
        class="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <CircleHelp class="size-4" />
      </Tooltip.Trigger>
      <Tooltip.Content>
        {$_('page.plan.adjustForInflationDescription')}
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
</div>
