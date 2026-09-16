<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { locale } from 'svelte-i18n'

  import { browser } from '$app/environment'
  import { page } from '$app/state'

  import { EVENTS, identify, track, trackerLoaded } from '$lib/analytics'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'
  import { syncStore } from '$lib/stores/sync.svelte'
  import { themeStore } from '$lib/stores/theme.svelte'

  import '../app.css'

  let { children } = $props()

  let cleanupSync: (() => void) | undefined
  let cleanupTheme: (() => void) | undefined
  let cleanupRemote: (() => void) | undefined

  // Umami analytics on the production host only; previews and localhost send
  // nothing. The iOS Instagram in-app browser drops scripts added to <head>,
  // so there the same tag goes into the body instead (legacy #942).
  const UMAMI_WEBSITE_ID = '792b102b-b18a-440b-9fce-58639490a4d2'
  const production = $derived(page.url.hostname === 'kalkul.app')
  const instagramIos =
    browser &&
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    navigator.userAgent.includes('Instagram')

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
    cleanupTheme = themeStore.init()
    cleanupRemote = syncStore.init()

    // One browser counts once across days, and "opened with data" is the
    // active-user signal as opposed to a landing-page visit.
    identify()
    if (appStore.profile.name) track(EVENTS.APP_OPEN, { plans: appStore.portfolios.length })
  })

  onDestroy(() => {
    cleanupSync?.()
    cleanupTheme?.()
    cleanupRemote?.()
  })
</script>

{#snippet tracker()}
  <script
    defer
    src="https://cloud.umami.is/script.js"
    data-website-id={UMAMI_WEBSITE_ID}
    onload={trackerLoaded}
  ></script>
{/snippet}

<svelte:head>
  {#if production && !instagramIos}
    {@render tracker()}
  {/if}
</svelte:head>

{@render children()}

{#if production && instagramIos}
  {@render tracker()}
{/if}
