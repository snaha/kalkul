<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  import { appStore } from '$lib/stores/app.svelte'

  import '../app.css'

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

{@render children()}
