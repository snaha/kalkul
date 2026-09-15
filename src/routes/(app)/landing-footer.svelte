<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import externalLinks from '$lib/external-links'

  interface Props {
    /** Year shown in the credit line, from the page's clock. */
    year: number
    /** The header hides its in-page links on phones; they live here instead. */
    howId: string
    privacyId: string
    onNavigate: (id: string) => void
  }

  let { year, howId, privacyId, onNavigate }: Props = $props()
</script>

<Separator />

<footer class="flex flex-wrap items-center justify-between gap-2 py-6">
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-2 sm:hidden">
      <Button variant="link" size="sm" onclick={() => onNavigate(howId)}>
        {$_('page.landing.nav.howItWorks')}
      </Button>
      <Button variant="link" size="sm" onclick={() => onNavigate(privacyId)}>
        {$_('page.landing.nav.privacy')}
      </Button>
    </div>
    <Button
      variant="link"
      size="sm"
      href={externalLinks.GITHUB}
      target="_blank"
      rel="noopener noreferrer"
    >
      {$_('page.landing.nav.github')}
    </Button>
    <Button
      variant="link"
      size="sm"
      href={externalLinks.DISCORD}
      target="_blank"
      rel="noopener noreferrer"
    >
      {$_('page.landing.footer.discord')}
    </Button>
    <Button
      variant="link"
      size="sm"
      href={externalLinks.AGPL_LICENSE}
      target="_blank"
      rel="noopener noreferrer"
    >
      {$_('page.landing.footer.terms')}
    </Button>
  </div>
  <span class="text-sm text-muted-foreground">
    {$_('page.landing.footer.madeBy', { values: { year: String(year) } })}
  </span>
</footer>
