<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import { Button } from '$lib/components/ui/button'
  import externalLinks from '$lib/external-links'
  import routes from '$lib/routes'

  interface Props {
    /** Ids of the sections the two in-page links jump to. */
    howId: string
    privacyId: string
    onNavigate: (id: string) => void
  }

  let { howId, privacyId, onNavigate }: Props = $props()
</script>

<header class="flex items-center justify-between gap-4 py-4">
  <a class="flex items-center gap-2" href={resolve(routes.HOME)}>
    <!-- The shipped logo is drawn in near-white for the app's dark navbar, so
         it keeps a dark tile here, as the navbar gives it. The wordmark next to
         it carries the name for screen readers. -->
    <span class="flex size-8 items-center justify-center rounded-lg bg-neutral-950">
      <img src={logo} alt="" class="size-6" />
    </span>
    <span class="text-lg font-bold">Kalkul</span>
  </a>

  <nav class="flex items-center gap-2">
    <!-- Hidden on phones, where the footer carries the same two links. -->
    <div class="hidden items-center gap-1 sm:flex">
      <Button variant="ghost" size="sm" onclick={() => onNavigate(howId)}>
        {$_('page.landing.nav.howItWorks')}
      </Button>
      <Button variant="ghost" size="sm" onclick={() => onNavigate(privacyId)}>
        {$_('page.landing.nav.privacy')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        href={externalLinks.GITHUB}
        target="_blank"
        rel="noopener noreferrer"
      >
        {$_('page.landing.nav.github')}
      </Button>
    </div>
    <Button href={resolve(routes.PROFILE)}>
      {$_('page.landing.cta.startPlanning')}
    </Button>
  </nav>
</header>
