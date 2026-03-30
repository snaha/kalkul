<script lang="ts">
  import { page } from '$app/state'
  import { appStore } from '$lib/stores/app.svelte'
  import { deriveGraphValueData } from '$lib/graph'
  import PdfExport from '$lib/components/pdf-export.svelte'
  import Loader from '$lib/components/ui/loader.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'
  import { _ } from 'svelte-i18n'
  import { getGraphDataForPortfolio } from '$lib/@snaha/kalkul-maths'
  import { getCSSVariableValue } from '$lib/css-vars'

  const portfolioId = $derived(page.params.portfolio_id)
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  // Read PDF export parameters from URL
  const searchParams = $derived(page.url.searchParams)
  const keyDates = $derived(
    searchParams
      .get('keyDates')
      ?.split(',')
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime())) || [],
  )
  const investments = $derived(portfolio?.investments ?? [])

  let isLoading = $derived(appStore.loading)

  let adjustWithInflation = $state(false)
  const graphResult = $derived(portfolio ? getGraphDataForPortfolio(portfolio) : undefined)
  const total = $derived(graphResult?.total)
  const data = $derived(graphResult?.data)

  const lowColor = getCSSVariableValue('--colors-low')
  const baseColor = `${getCSSVariableValue('--colors-base')}cc`

  const graphValueData = $derived(
    portfolio && investments && total && data
      ? deriveGraphValueData({
          portfolio,
          investments,
          total,
          data,
          lowColor,
          baseColor,
        })
      : undefined,
  )
</script>

<svelte:head>
  <title>{portfolio?.name} - PDF Export</title>
  <style>
    @media print {
      @page {
        size: A4 landscape;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</svelte:head>

{#if isLoading || !graphValueData}
  <Fullscreen>
    <Loader />
  </Fullscreen>
{:else if !portfolio}
  <Fullscreen>
    404 - {$_('common.notFound')}
  </Fullscreen>
{:else}
  <PdfExport
    {graphValueData}
    {adjustWithInflation}
    birthDate={new Date(appStore.profile.birth_date)}
    portfolioName={portfolio.name}
    profileName={appStore.profile.name}
    {keyDates}
  />
{/if}
