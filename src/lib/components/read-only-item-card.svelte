<script lang="ts">
  import { ChevronsUpDown } from '@lucide/svelte'

  import { Card, CardContent } from '$lib/components/ui/card'
  import { cn } from '$lib/utils'

  interface Props {
    name: string
    value: string
    dotColor?: string
    valueClass?: string
  }

  let { name, value, dotColor, valueClass }: Props = $props()
</script>

<Card class="gap-0 py-0">
  <CardContent class="p-4">
    <div class="flex w-full items-center gap-2">
      <span
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
      >
        <ChevronsUpDown class="size-4" />
      </span>
      {#if dotColor}
        <div class="size-4 shrink-0 rounded-xs" style:background-color={dotColor}></div>
      {/if}
      <span class="flex-1 truncate text-base font-medium">{name}</span>
      {#if value}
        <span class={cn('shrink-0 text-sm', valueClass ?? 'text-foreground')}>
          {value}
        </span>
      {/if}
    </div>
  </CardContent>
</Card>
