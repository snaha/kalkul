<script lang="ts">
  import { _ } from 'svelte-i18n'

  import type { RecordedCategory } from '$lib/components/chart-tooltip-content.svelte'
  import { cn } from '$lib/utils'

  type Props = {
    recorded: RecordedCategory
  }

  const { recorded }: Props = $props()
</script>

<!-- Under a category's plan row: what was recorded and how far it is from the
     plan, each amount right-aligned under the plan's. -->
<div class="flex flex-col pb-1 pl-6 text-xs">
  <div class="flex items-center justify-between gap-2">
    <span class="text-muted-foreground">{$_('page.plan.recorded')}</span>
    <span class="whitespace-nowrap text-muted-foreground tabular-nums">{recorded.value}</span>
  </div>
  <div class="flex items-center justify-between gap-2">
    <span class="text-muted-foreground">{$_('page.plan.againstPlan')}</span>
    <span class={cn('whitespace-nowrap tabular-nums', recorded.differenceClass)}>
      {recorded.difference}
    </span>
  </div>
</div>
