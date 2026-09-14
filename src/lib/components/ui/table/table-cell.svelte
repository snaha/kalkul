<script lang="ts">
  import type { HTMLTdAttributes } from 'svelte/elements'

  import { type WithElementRef, cn } from '$lib/utils'

  let {
    ref = $bindable(),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLTdAttributes> = $props()
</script>

<td
  bind:this={ref}
  data-slot="table-cell"
  class={cn(
    'bg-clip-padding p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</td>
