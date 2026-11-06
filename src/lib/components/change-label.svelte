<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  import { cn } from '$lib/utils'

  interface Props {
    /** The change: its sign picks the colour, its size is what `format` shows. */
    value: number
    format: (size: number) => string
  }

  let { value, format }: Props = $props()

  const sign = $derived(value > 0 ? '+' : value < 0 ? '−' : '±')
  const tone = $derived(
    value > 0
      ? 'bg-success/10 text-success'
      : value < 0
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground',
  )
</script>

<!-- How a figure moved since the previous reading: green up, red down, grey
     unchanged. -->
<Badge variant="outline" class={cn('border-transparent', tone)}>
  {sign}{format(Math.abs(value))}
</Badge>
