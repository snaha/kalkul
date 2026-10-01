<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FileDown from '@lucide/svelte/icons/file-down'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  import { Button } from '$lib/components/ui/button'
  import { downloadUnreadableData } from '$lib/download-backup'
  import { appStore } from '$lib/stores/app.svelte'

  // Mounted once in the root layout, so it shows on every page — the landing
  // page and onboarding included, which is where an app that opened empty
  // lands. Dismissing hides it for that data only: if another tab saves data
  // this one cannot read either, it comes back.
  let dismissedRaw = $state<string | undefined>(undefined)
  const unreadable = $derived(
    appStore.unreadableData?.raw === dismissedRaw ? undefined : appStore.unreadableData,
  )

  function dismiss(): void {
    dismissedRaw = appStore.unreadableData?.raw
  }
</script>

{#if unreadable}
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
    <div
      role="alert"
      class="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-destructive/50 bg-card px-4 py-3 shadow-lg"
    >
      <TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div class="flex flex-1 flex-col gap-3">
        <div class="flex flex-col gap-1">
          <p class="text-sm font-medium">{$_('common.unreadableData.title')}</p>
          <p class="text-xs text-muted-foreground">
            {$_('common.unreadableData.description')}
            {unreadable.kept
              ? $_('common.unreadableData.kept')
              : $_('common.unreadableData.notKept')}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" onclick={downloadUnreadableData}>
            <FileDown />
            {$_('common.unreadableData.download')}
          </Button>
          <!-- Without a copy kept, the only way on is downloading one: saves
               stay held back until then, and dismissing would hide why. -->
          {#if unreadable.kept}
            <Button size="sm" variant="ghost" onclick={dismiss}>
              {$_('common.unreadableData.dismiss')}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
