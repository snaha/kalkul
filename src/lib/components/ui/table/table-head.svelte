<script lang="ts">
  import type { HTMLThAttributes } from 'svelte/elements'

  import { type WithElementRef, cn } from '$lib/utils'

  let {
    ref = $bindable(),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLThAttributes> = $props()
</script>

<th
  bind:this={ref}
  data-slot="table-head"
  class={cn(
    'text-foreground h-10 bg-clip-padding px-2 text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</th>
