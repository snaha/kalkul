<script lang="ts">
  import GraphPortfolioValue from './graph-portfolio-value.svelte'
  import ChartDoughnut from './chart-doughnut.svelte'
  import PdfExportHeader from './pdf-export-header.svelte'
  import PdfExportFooter from './pdf-export-footer.svelte'
  import type { GraphPortfolioValue as GraphPortfolioValueType } from '$lib/graph'
  import { _, locale } from 'svelte-i18n'
  import Typography from './ui/typography.svelte'
  import Vertical from './ui/vertical.svelte'
  import Horizontal from './ui/horizontal.svelte'
  import Divider from './ui/divider.svelte'
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import { SERIES_COLORS } from '$lib/colors'
  import { formatCurrency } from '$lib/utils'

  interface Props {
    graphValueData: GraphPortfolioValueType
    adjustWithInflation: boolean
    birthDate?: Date
    portfolioName: string
    profileName?: string
    keyDates?: Date[]
  }

  let {
    graphValueData,
    adjustWithInflation,
    birthDate,
    portfolioName,
    keyDates = [],
  }: Props = $props()

  const viewLink = undefined

  // Calculate breakdown data for each key date
  const breakdownData = $derived.by(() => {
    if (!keyDates.length || !graphValueData) return []

    return keyDates.map((keyDate) => {
      // Find the closest data point index for this date
      const graphLabels = graphValueData.data[0]?.graphLabels || []

      // Find closest index to the target date
      let closestIndex = 0
      let minDiff = Infinity

      graphLabels.forEach((label, index) => {
        if (label.includes('-')) {
          const diff = Math.abs(new Date(label + '-01').getTime() - keyDate.getTime())
          if (diff < minDiff) {
            minDiff = diff
            closestIndex = index
          }
        } else {
          // Year only - use middle of year for comparison
          const yearDate = new Date(parseInt(label), 5, 15)
          const diff = Math.abs(yearDate.getTime() - keyDate.getTime())
          if (diff < minDiff) {
            minDiff = diff
            closestIndex = index
          }
        }
      })

      // Calculate investment values at this date
      const investmentValues = graphValueData.data.map((investment) => {
        const value = adjustWithInflation
          ? investment.graphInflationInvestmentValues[closestIndex] +
            investment.graphInflationDeposits[closestIndex] -
            investment.graphInflationWithdrawals[closestIndex] -
            investment.graphInflationFeeValues[closestIndex]
          : investment.graphInvestmentValues[closestIndex] +
            investment.graphDeposits[closestIndex] -
            investment.graphWithdrawals[closestIndex] -
            investment.graphFeeValues[closestIndex]

        return Math.max(0, value) // Ensure non-negative values
      })

      const totalValue = investmentValues.reduce((sum, value) => sum + value, 0)

      // Create investment list with colors and percentages, sorted by value (biggest to smallest)
      const investments = graphValueData.investments
        .map((investment, index) => ({
          name: investment.name,
          value: investmentValues[index],
          percentage: totalValue > 0 ? (investmentValues[index] / totalValue) * 100 : 0,
          colorIndex: investment.colorIndex ?? index,
          color: SERIES_COLORS[investment.colorIndex ?? index % SERIES_COLORS.length],
        }))
        .filter((inv) => inv.value > 0) // Only show investments with positive values
        .sort((a, b) => b.value - a.value) // Sort by value descending (biggest to smallest)

      return {
        date: keyDate,
        year: keyDate.getFullYear().toString(),
        investmentValues,
        investments,
        totalValue,
        selectedIndex: closestIndex,
      }
    })
  })

  // Group breakdown data into pages of maximum 4 charts each
  const breakdownPages = $derived.by(() => {
    if (!breakdownData.length) return []
    const pages = []
    for (let i = 0; i < breakdownData.length; i += 4) {
      pages.push(breakdownData.slice(i, i + 4))
    }
    return pages
  })

  // Calculate total number of pages (1 main page + breakdown pages)
  const totalPages = $derived(1 + breakdownPages.length)

  // Automatically open print dialog when page loads
  onMount(() => {
    if (browser) {
      // Small delay to ensure the page is fully rendered
      setTimeout(() => {
        window.print()
      }, 500)
    }
  })
</script>

<div class="pdf-document">
  <!-- Page 1: Full Chart with Header -->
  <div class="pdf-page">
    <PdfExportHeader {portfolioName} {viewLink} />

    <main class="page-content">
      <Vertical --gap="var(--padding)" style="height: 100%;">
        <div class="chart-title-section">
          <Horizontal --gap="var(--half-padding)" --alignment="center">
            <Typography
              bold
              style="font-size: 13.325px; line-height: 17.3225px; letter-spacing: 5%;"
            >
              {$_('component.PDFExport.value')}
            </Typography>
            {#if adjustWithInflation}
              <Typography color="green" style="font-size: 10.66px; ; line-height: 13.325px;">
                {$_('component.PDFExport.inflationAdjusted')}
              </Typography>
            {/if}
          </Horizontal>
        </div>

        <div class="full-chart-container">
          <GraphPortfolioValue {graphValueData} {adjustWithInflation} {birthDate} />
        </div>

        <PdfExportFooter pageNumber={1} {totalPages} />
      </Vertical>
    </main>
  </div>

  <!-- Breakdown Pages -->
  {#each breakdownPages as page, pageIndex}
    <div class="pdf-page">
      <PdfExportHeader {portfolioName} {viewLink} />

      <main class="page-content">
        <Vertical --vertical-gap="var(--padding)" style="height: 100%;">
          <!-- Breakdown charts grid -->
          <div class="breakdown-grid breakdown-grid-{page.length}">
            {#each page as breakdown}
              <div class="breakdown-item">
                <Vertical --vertical-gap="var(--half-padding)" --vertical-align-items="start">
                  <!-- Chart and Year/Label -->
                  <Horizontal
                    --horizontal-gap="var(--half-padding)"
                    --horizontal-align-items="center"
                  >
                    <div class="breakdown-chart">
                      <ChartDoughnut
                        data={breakdown.investmentValues}
                        labels={breakdown.investments.map((inv) => inv.name)}
                        investments={graphValueData?.investments || []}
                        currency={graphValueData?.portfolio?.currency || 'USD'}
                        currentYear={breakdown.year}
                        {birthDate}
                        {adjustWithInflation}
                      />
                    </div>

                    <!-- Year and label -->
                    <Vertical --vertical-gap="0" --vertical-align-items="start">
                      <Typography bold>{breakdown.year}</Typography>
                      <Typography variant="small">{$_('common.breakdown')}</Typography>
                    </Vertical>
                  </Horizontal>

                  <!-- Divider -->
                  <Divider --divider-color="black" --margin="var(--half-padding)" />

                  <!-- Investment list -->
                  <Vertical --vertical-gap="var(--half-padding)" style="width: 100%;">
                    {#each breakdown.investments as investment, index}
                      <Vertical --vertical-gap="2px" style="width: 100%;">
                        <!-- First line: color and name -->
                        <Horizontal
                          --horizontal-gap="var(--half-padding)"
                          --horizontal-align-items="center"
                          style="width: 100%;"
                        >
                          <div
                            class="investment-color-indicator"
                            style="background-color: {investment.color};"
                          ></div>
                          <Typography variant="small" bold>{investment.name}</Typography>
                        </Horizontal>

                        <!-- Second line: value and percentage -->
                        <Horizontal
                          --horizontal-gap="var(--half-padding)"
                          --horizontal-justify-content="space-between"
                          style="width: 100%;"
                        >
                          <Typography variant="small">
                            {formatCurrency(
                              investment.value,
                              graphValueData?.portfolio?.currency,
                              $locale,
                              {
                                maximumFractionDigits: 0,
                              },
                            )}
                          </Typography>
                          <Typography variant="small">
                            {investment.percentage.toFixed(1)}%
                          </Typography>
                        </Horizontal>
                      </Vertical>

                      {#if index < breakdown.investments.length - 1}
                        <Divider
                          --divider-color="black"
                          --margin="var(--half-padding)"
                          style="border-style: dashed;"
                        />
                      {/if}
                    {/each}
                  </Vertical>
                </Vertical>
              </div>
            {/each}
          </div>
        </Vertical>
      </main>

      <PdfExportFooter pageNumber={pageIndex + 2} {totalPages} />
    </div>
  {/each}
</div>

<style lang="postcss">
  @page {
    size: A4 landscape;
    margin: 1.5cm;
  }

  .pdf-document {
    background: white;
    color: black;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .pdf-page {
    width: 297mm;
    height: 210mm;
    padding: calc(var(--padding) * var(--print-multiplier));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    page-break-inside: avoid;
    margin: 0 auto;
  }

  .pdf-page:last-child {
    page-break-after: avoid;
  }

  .page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .chart-title-section {
    flex-shrink: 0;
    margin-bottom: calc(var(--half-padding) * var(--print-multiplier));
  }

  .full-chart-container {
    flex: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .full-chart-container :global(.chart-wrapper) {
    width: 100% !important;
    height: 100% !important;
  }

  .full-chart-container :global(canvas) {
    max-width: 100% !important;
    max-height: 100% !important;
  }

  /* Breakdown page styles */
  .breakdown-grid {
    display: grid;
    gap: calc(var(--padding) * var(--print-multiplier));
    width: 100%;
    height: 100%;
  }

  .breakdown-grid-1 {
    grid-template-columns: 1fr;
  }

  .breakdown-grid-2 {
    grid-template-columns: 1fr 1fr;
  }

  .breakdown-grid-3 {
    grid-template-columns: 1fr 1fr 1fr;
  }

  .breakdown-grid-4 {
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }

  .breakdown-item {
    min-width: 0;
  }

  .breakdown-chart {
    width: calc(110px * var(--print-multiplier));
    height: calc(110px * var(--print-multiplier));
    flex-shrink: 0;
  }

  .investment-color-indicator {
    width: calc(20px * var(--print-multiplier));
    height: calc(13px * var(--print-multiplier));
    border-radius: calc(4px * var(--print-multiplier));
    flex-shrink: 0;
  }

  /* Print styles */
  @media print {
    * {
      print-color-adjust: exact !important;
    }

    .pdf-document {
      margin: 0 !important;
      padding: 0 !important;
    }

    .pdf-page {
      margin: 0 !important;
    }

    /* Hide interactive elements */
    .pdf-document :global(.tooltip-investment),
    .pdf-document :global(.chart-tooltip) {
      display: none !important;
    }
  }
</style>
