<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Info from '@lucide/svelte/icons/info'
  import X from '@lucide/svelte/icons/x'

  import { Button } from '$lib/components/ui/button'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    /** Date the balances were last confirmed (date-only ISO string). */
    lastUpdated: string
    onQuickUpdate: () => void
  }

  let { lastUpdated, onQuickUpdate }: Props = $props()

  // Dismissed for the rest of the browser session, and only for this date: a
  // later update that goes stale again brings the alert back.
  let dismissedFor = $state(sessionStorage.getItem(storageKeys.STALE_DISMISSED))

  function dismiss() {
    dismissedFor = lastUpdated
    sessionStorage.setItem(storageKeys.STALE_DISMISSED, lastUpdated)
  }
</script>

{#if dismissedFor !== lastUpdated}
  <div class="flex items-start gap-2 rounded-lg bg-notice px-2.5 py-2">
    <Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 items-center gap-0.5">
      <div class="flex min-w-0 flex-1 flex-col">
        <p class="truncate text-sm font-medium">
          {$_('page.dashboard.finances.stale.title', {
            values: { date: appStore.formatDateOnlyMedium(lastUpdated) },
          })}
        </p>
        <p class="text-xs">
          {$_('page.dashboard.finances.stale.description')}
        </p>
      </div>
      <Button onclick={onQuickUpdate}>
        {$_('page.dashboard.finances.stale.quickUpdate')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={$_('page.dashboard.finances.stale.dismiss')}
        onclick={dismiss}
      >
        <X />
      </Button>
    </div>
  </div>
{/if}
