<script lang="ts">
  import { cn } from '$lib/utils'

  interface Props {
    label: string
    amount: string
    color?: string
    bold?: boolean
    negative?: boolean
  }

  let { label, amount, color, bold = false, negative = false }: Props = $props()
</script>

<div class="flex items-center gap-3 py-2 text-base">
  {#if color}
    <div class="size-4 shrink-0 rounded-xs" style:background-color={color}></div>
  {:else}
    <div class="size-4 shrink-0"></div>
  {/if}
  <span class={cn('flex-1', bold && 'font-bold')}>{label}</span>
  <span class={cn(bold && 'font-bold', negative && 'text-destructive')}>{amount}</span>
</div>
