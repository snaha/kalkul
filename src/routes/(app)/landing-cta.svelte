<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { EVENTS, track } from '$lib/analytics'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  import { NEWSLETTER_USERNAME } from './landing-newsletter'
  import { SAMPLE } from './landing-sample'

  interface Props {
    /** Shown next to the buttons; omitted in the closing section. */
    hint?: string
  }

  let { hint }: Props = $props()

  // No "this will replace your data" confirmation: the landing is only rendered
  // when nothing is stored, so there is nothing to overwrite. The page turns
  // into the dashboard by itself once the import lands.
  async function tryDemo(): Promise<void> {
    track(EVENTS.LANDING_TRY_DEMO)
    appStore.importBackup(JSON.stringify(SAMPLE))
    await goto(resolve(routes.HOME))
  }
</script>

{#if NEWSLETTER_USERNAME}
  <!-- ponytail: a plain POST to Buttondown's embed endpoint, which lands on
       their "check your inbox" page. CSP form-action is not covered by
       default-src, so no policy change. Switch to fetch + inline thanks if
       leaving the page turns out to cost signups. -->
  <form
    class="flex flex-col gap-2"
    action={externalLinks.BUTTONDOWN_SUBSCRIBE + NEWSLETTER_USERNAME}
    method="post"
    onsubmit={() => track(EVENTS.LANDING_NEWSLETTER_SUBSCRIBE)}
  >
    <div class="flex flex-wrap items-center gap-3">
      <Input
        type="email"
        name="email"
        required
        autocomplete="email"
        placeholder={$_('page.landing.newsletter.placeholder')}
        aria-label={$_('page.landing.newsletter.placeholder')}
        class="h-10 w-full max-w-xs sm:w-auto"
      />
      <Button type="submit" size="lg">{$_('page.landing.newsletter.subscribe')}</Button>
    </div>
    <span class="text-sm text-muted-foreground">{$_('page.landing.newsletter.hint')}</span>
  </form>
{:else}
  <div class="flex flex-wrap items-center gap-3">
    <Button
      size="lg"
      href={resolve(routes.PROFILE)}
      onclick={() => track(EVENTS.LANDING_START_PLANNING)}
    >
      {$_('page.landing.cta.startPlanning')}
    </Button>
    <Button variant="outline" size="lg" onclick={tryDemo}>
      {$_('page.landing.cta.tryDemo')}
    </Button>
    {#if hint}
      <span class="text-sm text-muted-foreground">{hint}</span>
    {/if}
  </div>
{/if}
