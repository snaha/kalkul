<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import '../app.css'
  import { appStore } from '$lib/stores/app.svelte'

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
