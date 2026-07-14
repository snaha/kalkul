<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { locale } from 'svelte-i18n'

  import StorageErrorBanner from '$lib/components/storage-error-banner.svelte'
  import StorageRecoveryDialog from '$lib/components/storage-recovery-dialog.svelte'
  import { appStore } from '$lib/stores/app.svelte'

  import '../app.css'

  let { children } = $props()

  let cleanupSync: (() => void) | undefined

  $effect(() => {
    appStore.browserLocale = $locale ?? undefined
  })

  onMount(() => {
    // Data is loaded synchronously in +layout.ts before render; here we only
    // wire up cross-tab sync, which needs the browser `window`.
    cleanupSync = appStore.startSync()
  })

  onDestroy(() => {
    cleanupSync?.()
  })
</script>

{@render children()}
<StorageErrorBanner />
<StorageRecoveryDialog />
