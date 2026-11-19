<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Info from '@lucide/svelte/icons/info'
  import X from '@lucide/svelte/icons/x'

  import { Button } from '$lib/components/ui/button'
  import { dismiss, isDismissed } from '$lib/session-dismissal'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    /** Date the balances were last confirmed (date-only ISO string). */
    lastUpdated: string
    onQuickUpdate: () => void
  }

  let { lastUpdated, onQuickUpdate }: Props = $props()

  // Dismissed for the rest of the browser session, and only for this date on
  // this profile: a later update that goes stale again brings the alert back,
  // and so does switching to another demo persona or dev preset.
  const dismissalState = $derived(`${lastUpdated}|${appStore.profile.name}`)
  let dismissals = $state(0)
  const dismissed = $derived.by(() => {
    void dismissals
    return isDismissed(storageKeys.STALE_DISMISSED, dismissalState)
  })

  function close() {
    dismiss(storageKeys.STALE_DISMISSED, dismissalState)
    dismissals += 1
  }
</script>

{#if !dismissed}
  <div class="flex items-start gap-2 rounded-lg bg-notice px-2.5 py-2">
    <Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 items-center gap-0.5">
      <div class="flex min-w-0 flex-1 flex-col">
        <p class="text-sm font-medium">
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
        onclick={close}
      >
        <X />
      </Button>
    </div>
  </div>
{/if}
