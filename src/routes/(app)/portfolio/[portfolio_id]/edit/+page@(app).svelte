<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { page } from '$app/state'
  import EditPortfolio from '$lib/components/edit-portfolio.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import { appStore } from '$lib/stores/app.svelte'

  const portfolioId = page.params.portfolio_id
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  function close() {
    history.back()
  }
</script>

<Fullscreen>
  {#if portfolio}
    <EditPortfolio {close} {portfolio} />
  {:else}
    <Typography variant="h2">404 - {$_('common.notFound')}</Typography>
  {/if}
</Fullscreen>
