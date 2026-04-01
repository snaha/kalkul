<script lang="ts">
  import Chart from '$lib/components/chart.svelte'
  import type { TooltipData, CustomDataset } from '$lib/types'
  import TooltipInvestment from './tooltip-investment.svelte'
  import type { GraphPortfolioValue } from '$lib/graph'
  import { locale } from 'svelte-i18n'
  import { drawExclamationMarks, drawExhaustionLine } from '$lib/chart-utils'

  interface Props {
    graphValueData: GraphPortfolioValue
    adjustWithInflation: boolean
    birthDate?: Date
    disableInteraction?: boolean
  }

  let {
    graphValueData: graphValuesStore,
    adjustWithInflation,
    birthDate,
    disableInteraction = false,
  }: Props = $props()

  let investmentsTooltipData: TooltipData[] = $state([])
  let tooltipPosition = $state({ x: 0, y: 0 })
  let chartWidth = $state(0)

  // Responsive label and gridline frequency based on chart width
  const labelFrequency = $derived.by(() => {
    if (chartWidth < 400) return 6 // Mobile: show fewer labels
    if (chartWidth < 768) return 4 // Tablet: moderate labels
    return 2 // Desktop: show more labels
  })

  // Store locale for use in callbacks
  const currentLocale = $derived($locale)

  // Indices of all periods where any investment is exhausted
  const zeroCrossingIndices = $derived(() => {
    const graphLabels = graphValuesStore.data[0]?.graphLabels
    if (!graphLabels) return []

    const indices = new Set<number>()

    // Collect exhaustion dates from all investments
    for (const investment of graphValuesStore.data) {
      const exhaustionDate = investment.exhaustionWarning?.date
      if (!exhaustionDate) continue

      // Find the index for this exhaustion date
      for (let i = 0; i < graphLabels.length; i++) {
        const label = graphLabels[i]

        if (label.includes('-')) {
          const [yearStr, monthStr] = label.split('-')
          const year = parseInt(yearStr, 10)
          const month = parseInt(monthStr, 10)

          const labelDate = new Date(year, month - 1, 1)
          const nextMonth = new Date(year, month, 1)

          if (exhaustionDate >= labelDate && exhaustionDate < nextMonth) {
            indices.add(i)
            break
          }
        } else {
          const labelDate = new Date(label)
          if (labelDate.getFullYear() >= exhaustionDate.getFullYear()) {
            indices.add(i)
            break
          }
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b)
  })

  const firstZeroCrossingIndex = $derived(zeroCrossingIndices()[0])
</script>

<Chart
  type="line"
  bind:width={chartWidth}
  labels={graphValuesStore.data[0]?.graphLabels}
  datasets={adjustWithInflation
    ? graphValuesStore.investmentGraphDataWithInflation
    : graphValuesStore.investmentGraphData}
  zeroCrossingIndex={firstZeroCrossingIndex}
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
        min: 0,
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
        grid: {
          offset: false,
          color: ({ index }) => (index % labelFrequency === 0 ? 'rgba(0,0,0,0.1)' : 'transparent'),
        },
        ticks: {
          autoSkip: false,
          callback: function (_, index) {
            return index % labelFrequency === 0 ? this.getLabelForValue(index) : ''
          },
        },
      },
    },
    elements: {
      point: {
        radius: 0,
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
                investmentsTooltipData = []
              } else {
                tooltipPosition = {
                  x: tooltip.caretX,
                  y: tooltip.caretY,
                }
                // Check if current period is at or after any exhaustion
                const currentDataIndex = tooltip.dataPoints[0]?.dataIndex
                const hasWithdrawalError =
                  currentDataIndex !== undefined &&
                  firstZeroCrossingIndex !== undefined &&
                  currentDataIndex >= firstZeroCrossingIndex

                const filteredDataPoints = tooltip.dataPoints.filter((d) => {
                  if (d?.dataset?.label?.startsWith('_hidden')) return false
                  return d.raw !== 0 || hasWithdrawalError
                })

                if (filteredDataPoints.length === 0 && hasWithdrawalError) {
                  filteredDataPoints.push(
                    ...tooltip.dataPoints.filter((d) => !d?.dataset?.label?.startsWith('_hidden')),
                  )
                }

                investmentsTooltipData = filteredDataPoints.map((d) => {
                  const dataset = d.dataset as CustomDataset<'line'>
                  return {
                    dataIndex: d.dataIndex,
                    value: d.raw as number,
                    colorIndex: dataset.colorIndex,
                    name: dataset.label,
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
  plugins={!disableInteraction
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
<TooltipInvestment
  {tooltipPosition}
  tooltipData={investmentsTooltipData}
  totalValue={graphValuesStore.totalValue}
  totalWithInflation={graphValuesStore.totalWithInflation}
  {adjustWithInflation}
  currency={graphValuesStore.portfolio.currency}
  graphLabels={graphValuesStore.data[0]?.graphLabels}
  investmentData={graphValuesStore.data.map((inv, index) => ({
    id: String(graphValuesStore.investments[index]?.id || ''),
    name: inv.label,
    exhaustionDate: inv.exhaustionWarning?.date,
    missingAmount: inv.exhaustionWarning?.missingAmount ?? 0,
  }))}
  year={(() => {
    if (investmentsTooltipData.length === 0 || !graphValuesStore.data[0]?.graphLabels)
      return new Date().getFullYear()
    const label = graphValuesStore.data[0].graphLabels[investmentsTooltipData[0].dataIndex]
    if (label?.includes('-')) {
      return parseInt(label.split('-')[0], 10)
    } else {
      return parseInt(label, 10)
    }
  })()}
  {birthDate}
  disabled={disableInteraction}
/>
