<script lang="ts">
  import { CircleHelp } from '@lucide/svelte'

  import * as Tooltip from '$lib/components/ui/tooltip'
  import { cn } from '$lib/utils'

  interface Props {
    text: string
    class?: string
  }

  let { text, class: className }: Props = $props()

  let open = $state(false)
</script>

<Tooltip.Provider delayDuration={150}>
  <Tooltip.Root bind:open disableCloseOnTriggerClick>
    <Tooltip.Trigger
      type="button"
      aria-label={text}
      onclick={() => (open = !open)}
      class={cn('shrink-0 text-muted-foreground hover:text-foreground', className)}
    >
      <CircleHelp class="size-4" />
    </Tooltip.Trigger>
    <Tooltip.Content>{text}</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
