<script lang="ts">
  import { page } from '$app/state'
  import EditInvestment from '$lib/components/edit-investment.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'
  import Loader from '$lib/components/ui/loader.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import { appStore } from '$lib/stores/app.svelte'
  import { _ } from 'svelte-i18n'

  const portfolioId = page.params.portfolio_id
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  function close() {
    history.back()
  }
</script>

<Fullscreen hasCustomHeader={false}>
  {#if appStore.loading}
    <Loader />
  {:else if portfolio}
    <EditInvestment {close} {portfolio} />
  {:else}
    <Typography variant="h2">404 - {$_('common.notFound')}</Typography>
  {/if}
</Fullscreen>
