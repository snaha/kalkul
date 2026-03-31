<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import '../app.pcss'
  import { appStore } from '$lib/stores/app.svelte'
  import StorageErrorBanner from '$lib/components/storage-error-banner.svelte'

  let { children } = $props()

  let cleanupSync: (() => void) | undefined

  onMount(() => {
    appStore.load()
    cleanupSync = appStore.startSync()
  })

  onDestroy(() => {
    cleanupSync?.()
  })
</script>

<StorageErrorBanner />
{@render children()}
