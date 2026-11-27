<script lang="ts">
  import { _ } from 'svelte-i18n'

  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  import { Button } from '$lib/components/ui/button'
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
  <div
    role="alert"
    class="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-destructive/50 bg-card px-4 py-3 shadow-lg"
  >
    <TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
    <div class="flex flex-1 flex-col gap-3">
      <div class="flex flex-col gap-1">
        <p class="text-sm font-medium">{$_('common.newerData.title')}</p>
        <p class="text-xs text-muted-foreground">{$_('common.newerData.description')}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button size="sm" onclick={() => window.location.reload()}>
          <RefreshCw />
          {$_('common.newerData.reload')}
        </Button>
      </div>
    </div>
  </div>
</div>
