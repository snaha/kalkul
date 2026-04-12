<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { locale } from 'svelte-i18n'

  import { appStore } from '$lib/stores/app.svelte'

  import '../app.css'

  let { children } = $props()

  let cleanupSync: (() => void) | undefined

  $effect(() => {
    appStore.browserLocale = $locale ?? undefined
  })

  onMount(() => {
    appStore.load()
    cleanupSync = appStore.startSync()
  })

  onDestroy(() => {
    cleanupSync?.()
  })
</script>

{@render children()}
