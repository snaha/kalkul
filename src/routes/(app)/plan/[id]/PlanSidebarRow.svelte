<script lang="ts">
  import { cn } from '$lib/utils'

  interface Props {
    name: string
    value: string
    valueClass?: string
    dense?: boolean
    onclick?: () => void
  }

  let { name, value, valueClass, dense = false, onclick }: Props = $props()
</script>

<button
  type="button"
  {onclick}
  class={cn(
    'flex w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-accent',
    dense ? 'h-7' : 'h-8',
  )}
>
  <span class="min-w-0 flex-1 truncate">{name}</span>
  <span class={cn('shrink-0 tabular-nums', valueClass ?? 'text-muted-foreground')}>
    {value}
  </span>
</button>
