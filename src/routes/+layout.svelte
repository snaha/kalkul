<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { locale } from 'svelte-i18n'

  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'

  import '../app.css'

  let { children } = $props()

  let cleanupSync: (() => void) | undefined

  $effect(() => {
    appStore.browserLocale = $locale ?? undefined
  })

  // Persist the user's chosen UI language from the profile. resolveLocale()
  // reads localStorage first on init, so keeping this key in sync makes the
  // choice stick across reloads and overrides browser auto-detect. Guarded on
  // appStore.loading so a stored language doesn't fight the initial locale.
  $effect(() => {
    const language = appStore.profile.language
    if (!appStore.loading && language && language !== $locale) {
      locale.set(language)
      localStorage.setItem(storageKeys.LOCALE, language)
    }
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
