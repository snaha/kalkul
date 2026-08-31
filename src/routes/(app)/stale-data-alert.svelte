<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Info from '@lucide/svelte/icons/info'

  import { Button } from '$lib/components/ui/button'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    /** Date the balances were last confirmed (date-only ISO string). */
    lastUpdated: string
    onQuickUpdate: () => void
  }

  let { lastUpdated, onQuickUpdate }: Props = $props()
</script>

<div class="flex items-start gap-3 rounded-xl border bg-muted/50 px-2.5 py-2">
  <Info class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  <div class="flex flex-1 items-start gap-4">
    <div class="flex flex-1 flex-col">
      <p class="text-sm font-medium">
        {$_('page.dashboard.finances.stale.title', {
          values: { date: appStore.formatDateOnly(lastUpdated) },
        })}
      </p>
      <p class="text-xs text-muted-foreground">
        {$_('page.dashboard.finances.stale.description')}
      </p>
    </div>
    <Button size="sm" onclick={onQuickUpdate}>
      {$_('page.dashboard.finances.stale.quickUpdate')}
    </Button>
  </div>
</div>
