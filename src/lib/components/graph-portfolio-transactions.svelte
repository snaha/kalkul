<script lang="ts">
  import Chart from '$lib/components/chart.svelte'
  import type { Portfolio, TooltipData, CustomDataset } from '$lib/types'
  import TooltipTransaction from './tooltip-transaction.svelte'
  import type { GraphPortfolioTransactions } from '$lib/graph'
  import { locale } from 'svelte-i18n'
  import { drawExclamationMarks, drawExhaustionLine } from '$lib/chart-utils'

  interface Props {
    graphTransactionsData: GraphPortfolioTransactions
    portfolio: Portfolio
    adjustWithInflation: boolean
    showDeposits: boolean
    showWithdrawals: boolean
    showFees: boolean
    birthDate?: Date
    disableInteraction?: boolean
  }

  let {
    graphTransactionsData,
    portfolio,
    adjustWithInflation,
    showDeposits,
    showWithdrawals,
    showFees,
    birthDate,
    disableInteraction = false,
  }: Props = $props()

  let transactionTooltipData: TooltipData[] = $state([])
  let tooltipPosition = $state({ x: 0, y: 0 })
  let chartWidth = $state(0)

  // Responsive label and gridline frequency based on chart width
  const labelFrequency = $derived.by(() => {
    if (chartWidth < 400) return 6 // Mobile: show fewer labels
    if (chartWidth < 768) return 4 // Tablet: moderate labels
    return 2 // Desktop: show more labels
  })

  const gridlineFrequency = $derived.by(() => {
    return labelFrequency // Keep gridlines in sync with labels
  })

  // Store locale for use in callbacks
  const currentLocale = $derived($locale)

  // Calculate all zero-crossing indices from all exhausted investments
  const zeroCrossingIndices = $derived(() => {
    const graphLabels = graphTransactionsData.data[0]?.graphLabels
    if (!graphLabels) return []

    const indices = new Set<number>()

    // Collect exhaustion dates from all investments
    for (const investment of graphTransactionsData.data) {
      const investmentExhaustionDate = investment.exhaustionWarning?.date
      if (!investmentExhaustionDate) continue

      // Find the index where the exhaustion date falls
      for (let i = 0; i < graphLabels.length; i++) {
        const label = graphLabels[i]

        // Handle monthly format like "2024-8"
        if (label.includes('-')) {
          const [yearStr, monthStr] = label.split('-')
          const year = parseInt(yearStr, 10)
          const month = parseInt(monthStr, 10)

          // Check if exhaustion date falls within this month
          const labelDate = new Date(year, month - 1, 1) // First day of month
          const nextMonth = new Date(year, month, 1) // First day of next month

          if (investmentExhaustionDate >= labelDate && investmentExhaustionDate < nextMonth) {
            indices.add(i)
            break
          }
        } else {
          // Handle yearly format
          const labelDate = new Date(label)
          if (labelDate.getFullYear() >= investmentExhaustionDate.getFullYear()) {
            indices.add(i)
            break
          }
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b)
  })

  // Pre-calculate datasets to avoid complex logic in template
  const chartDatasets = $derived.by(() => {
    const datasets = []

    // Extract inflation items if needed
    const withdrawalInflation =
      adjustWithInflation && showWithdrawals
        ? graphTransactionsData.withdrawalsWithInflation.at(-1)
        : null
    const feeInflation =
      adjustWithInflation && showFees ? graphTransactionsData.feesWithInflation.at(-1) : null

    // Add withdrawals (excluding inflation)
    if (showWithdrawals) {
      const data = adjustWithInflation
        ? graphTransactionsData.withdrawalsWithInflation.slice(0, -1)
        : graphTransactionsData.withdrawals
      datasets.push(...data)
    }

    // Add deposits
    if (showDeposits) {
      const data = adjustWithInflation
        ? graphTransactionsData.depositsWithInflation
        : graphTransactionsData.deposits
      datasets.push(...data)
    }

    // Add fees (excluding inflation)
    if (showFees) {
      const data = adjustWithInflation
        ? graphTransactionsData.feesWithInflation.slice(0, -1)
        : graphTransactionsData.fees
      datasets.push(...data)
    }

    // Add combined inflation as last item
    if (withdrawalInflation && feeInflation) {
      // Combine both inflations
      datasets.push({
        ...withdrawalInflation,
        data: withdrawalInflation.data.map((val, i) => {
          const w = typeof val === 'number' ? val : 0
          const f = typeof feeInflation.data[i] === 'number' ? feeInflation.data[i] : 0
          return w + f
        }),
      })
    } else if (withdrawalInflation) {
      datasets.push(withdrawalInflation)
    } else if (feeInflation) {
      datasets.push(feeInflation)
    }

    return datasets
  })
</script>

<Chart
  type="bar"
  bind:width={chartWidth}
  labels={graphTransactionsData.data[0]?.graphLabels}
  datasets={chartDatasets}
  disableHover={disableInteraction}
  options={{
    interaction: disableInteraction
      ? {
          mode: undefined,
        }
      : {
          intersect: false,
          mode: 'index',
        },
    scales: {
      y: {
        stacked: true,
        border: {
          display: false,
        },
        ticks: {
          callback: function (value) {
            if (typeof value === 'number') {
              return new Intl.NumberFormat(currentLocale || undefined).format(value)
            }
            return value
          },
        },
      },
      x: {
        stacked: true,
        grid: {
          offset: false,
          color: ({ index }) =>
            index % gridlineFrequency === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
        },
        type: 'category',
        ticks: {
          autoSkip: false,
          callback: function (_, index) {
            return index % labelFrequency === 0 ? this.getLabelForValue(index) : ''
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
        external: disableInteraction
          ? undefined
          : (context) => {
              const { tooltip } = context

              if (tooltip.opacity === 0) {
                transactionTooltipData = []
              } else {
                tooltipPosition = {
                  x: tooltip.caretX,
                  y: tooltip.caretY,
                }

                transactionTooltipData = tooltip.dataPoints
                  .filter((d) => d.raw !== 0)
                  .map((d) => {
                    const dataset = d.dataset as CustomDataset<'bar'>
                    return {
                      dataIndex: d.dataIndex,
                      value: d.raw as number,
                      colorIndex: dataset.colorIndex,
                      name: dataset.label,
                      type: dataset.colorIndex !== undefined ? 'transaction' : 'fee',
                    }
                  })
              }
              const graphWidth = context.chart.width
              const tooltipWidth = 321

              tooltipPosition.y += 32

              if (tooltipPosition.x < graphWidth / 2) {
                tooltipPosition.x += tooltipWidth + 16
              } else {
                tooltipPosition.x -= 16
              }
            },
      },
    },
    animation: false,
  }}
  plugins={disableInteraction
    ? [
        {
          id: 'verticalLine',
          afterDraw(chart) {
            if (chart?.tooltip && chart.tooltip.opacity > 0) {
              const ctx = chart.ctx
              const x = chart.tooltip.caretX
              const yAxis = chart.scales.y

              ctx.save()
              ctx.beginPath()
              ctx.moveTo(x, yAxis.top)
              ctx.lineTo(x, yAxis.bottom)
              ctx.lineWidth = 1
              ctx.strokeStyle = 'gray'
              ctx.stroke()
              ctx.restore()
            }
          },
        },
        {
          id: 'withdrawalErrorIndicator',
          afterDraw(chart) {
            const errorIndices = zeroCrossingIndices()
            if (errorIndices.length === 0) return

            const ctx = chart.ctx
            const yAxis = chart.scales.y
            const xAxis = chart.scales.x
            const lineY = yAxis.bottom

            ctx.save()

            // Draw red line from first exhaustion to end
            drawExhaustionLine(ctx, xAxis, lineY, errorIndices[0])

            // Draw warning icon for EACH exhausted investment
            const iconY = lineY - 20
            drawExclamationMarks(ctx, xAxis, iconY, errorIndices)

            ctx.restore()
          },
        },
      ]
    : []}
/>
<TooltipTransaction
  {tooltipPosition}
  tooltipData={transactionTooltipData}
  totalDeposits={graphTransactionsData.totalDeposits}
  totalDepositsWithInflation={graphTransactionsData.totalDepositsWithInflation}
  totalWithdrawals={graphTransactionsData.totalWithdrawals}
  totalWithdrawalsWithInflation={graphTransactionsData.totalWithdrawalsWithInflation}
  totalFees={graphTransactionsData.totalFees}
  totalFeesWithInflation={graphTransactionsData.totalFeesWithInflation}
  {adjustWithInflation}
  {showFees}
  currency={portfolio.currency}
  year={(() => {
    if (transactionTooltipData.length === 0 || !graphTransactionsData.data[0]?.graphLabels)
      return new Date().getFullYear()
    const label = graphTransactionsData.data[0].graphLabels[transactionTooltipData[0].dataIndex]
    if (label?.includes('-')) {
      return parseInt(label.split('-')[0], 10)
    } else {
      return parseInt(label, 10)
    }
  })()}
  {birthDate}
  disabled={disableInteraction}
/>
