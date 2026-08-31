<script lang="ts">
  import type { Snippet } from 'svelte'

  import Info from '@lucide/svelte/icons/info'
  import Settings from '@lucide/svelte/icons/settings'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'

  interface Props {
    title: string
    help: string
    /** Accessible name for the gear button that opens this metric's settings. */
    settingsLabel: string
    onSettings: () => void
    children: Snippet
  }

  let { title, help, settingsLabel, onSettings, children }: Props = $props()
</script>

<!-- Shared shell for the Runway and Financial independence cards: a titled
     header with a hint and a settings gear, over a single headline figure. -->
<Card.Root class="gap-0 py-0 shadow-xs">
  <Card.Content class="flex flex-col p-4">
    <div class="flex items-center gap-2">
      <div class="flex flex-1 items-center gap-1">
        <p class="text-sm font-medium">{title}</p>
        <HelpTooltip text={help} icon={Info} iconClass="size-3" />
      </div>
      <Button variant="ghost" size="icon-xs" aria-label={settingsLabel} onclick={onSettings}>
        <Settings />
      </Button>
    </div>
    {@render children()}
  </Card.Content>
</Card.Root>
