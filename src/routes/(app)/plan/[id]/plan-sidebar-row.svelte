<script lang="ts">
  import { _ } from 'svelte-i18n'

  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  import * as Tooltip from '$lib/components/ui/tooltip'
  import { cn } from '$lib/utils'

  interface Props {
    name: string
    value: string
    valueClass?: string
    dense?: boolean
    hasInsufficientFunds?: boolean
    onclick?: () => void
  }

  let {
    name,
    value,
    valueClass,
    dense = false,
    hasInsufficientFunds = false,
    onclick,
  }: Props = $props()
</script>

<button
  type="button"
  {onclick}
  class={cn(
    'flex w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm',
    dense ? 'h-7' : 'h-8 hover:bg-accent',
  )}
>
  <span class={cn('min-w-0 flex-1 truncate', hasInsufficientFunds && 'text-destructive')}>
    {name}
  </span>
  {#if hasInsufficientFunds}
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <span
              {...props}
              aria-label={$_('page.plan.insufficientFundsTooltip')}
              class="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive tabular-nums"
            >
              <TriangleAlert class="size-3" />
              {value}
            </span>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>
          {$_('page.plan.insufficientFundsTooltip')}
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  {:else}
    <span
      class={cn(
        'shrink-0 tabular-nums',
        // Non-dense rows live in the cash-flow / asset sidebar and follow the
        // Figma spec: 12px medium-weight in the default foreground colour.
        // Dense rows live in the right inspector panel and keep the existing
        // sm sizing until that panel gets its own design pass.
        dense ? 'text-sm' : 'text-xs font-medium',
        valueClass ?? (dense ? 'text-muted-foreground' : 'text-foreground'),
      )}
    >
      {value}
    </span>
  {/if}
</button>
