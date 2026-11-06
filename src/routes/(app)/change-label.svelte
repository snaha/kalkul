<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Badge } from '$lib/components/ui/badge'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'

  interface Props {
    /** The change: its sign picks the colour, its size is what `format` shows. */
    value: number
    /** Date of the update the change is measured from. */
    since: string
    format: (size: number) => string
  }

  let { value, since, format }: Props = $props()

  const sign = $derived(value > 0 ? '+' : value < 0 ? '−' : '±')
  const tone = $derived(
    value > 0
      ? 'bg-success/10 text-success'
      : value < 0
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground',
  )
</script>

<!-- How a headline figure moved since the previous update (#292): a small
     label after the figure rather than the spec's tooltips and banner. -->
<Badge
  variant="outline"
  class={cn('border-transparent', tone)}
  title={$_('page.dashboard.finances.change.since', {
    values: { date: appStore.formatDateOnly(since) },
  })}
>
  {sign}{format(Math.abs(value))}
</Badge>
