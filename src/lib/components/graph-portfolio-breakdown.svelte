<script lang="ts">
  import Typography from '$lib/components/ui/typography.svelte'
  import Chart from '$lib/components/chart.svelte'
  import type { InvestmentWithColorIndex, Portfolio, TooltipData, CustomDataset } from '$lib/types'
  import type { GraphData } from '$lib/@snaha/kalkul-maths'
  import { getCumulativeValues } from '$lib/@snaha/kalkul-maths'
  import Horizontal from './ui/horizontal.svelte'
  import Slider from './ui/slider.svelte'
  import ChartDoughnut from './chart-doughnut.svelte'
  import TooltipBreakdownBar from './tooltip-breakdown-bar.svelte'
  import { _, locale } from 'svelte-i18n'

  interface Props {
    portfolio: Portfolio
    investments: InvestmentWithColorIndex[]
    adjustWithInflation: boolean
    selectedIndex: number
    data: GraphData[]
    total: GraphData
    lowColor: string
    baseColor: string
    birthDate?: Date
    showInvestmentValue: boolean
    showInterestEarned: boolean
    showDeposited: boolean
    showWithdrawn: boolean
    showFees: boolean
    disableInteraction?: boolean
  }

  let {
    portfolio,
    investments,
    adjustWithInflation,
    selectedIndex = $bindable(0),
    data,
    total,
    lowColor,
    baseColor,
    birthDate,
    showInvestmentValue,
    showInterestEarned,
    showDeposited,
    showWithdrawn,
    showFees,
    disableInteraction = false,
  }: Props = $props()

  const breakdownChartData = $derived(
    data.map((r, i) => {
      const values = getCumulativeValues(r, selectedIndex)

      return {
        data: [
          values.currentValue,
          values.cumulativeInterest,
          values.cumulativeDeposits,
          -values.cumulativeWithdrawals,
          -values.cumulativeFees,
        ],
        label: r.label,
        colorIndex: investments[i].colorIndex ?? i,
        fill: 'origin',
        hidden: investments[i].hidden ?? false,
      }
    }),
  )

  const breakdownInflationChartData = $derived([
    ...data.map((r, i) => {
      const values = getCumulativeValues(r, selectedIndex, true)

      return {
        data: [
          values.currentValue,
          values.cumulativeInterest,
          values.cumulativeDeposits,
          -values.cumulativeWithdrawals,
          -values.cumulativeFees,
        ],
        label: r.label,
        colorIndex: investments[i].colorIndex ?? i,
        fill: 'origin',
        hidden: investments[i].hidden ?? false,
      }
    }),
    {
      data: (() => {
        const normalValues = getCumulativeValues(total, selectedIndex)
        const inflationValues = getCumulativeValues(total, selectedIndex, true)

        return [
          normalValues.currentValue - inflationValues.currentValue,
          normalValues.cumulativeInterest - inflationValues.cumulativeInterest,
          normalValues.cumulativeDeposits - inflationValues.cumulativeDeposits,
          -(normalValues.cumulativeWithdrawals + inflationValues.cumulativeWithdrawals),
          -(normalValues.cumulativeFees + inflationValues.cumulativeFees),
        ]
      })(),
      label: '_hidden',
      borderColor: lowColor,
      borderWidth: 1,
      backgroundColor: baseColor,
    },
  ])

  const totalValue = $derived.by(() => {
    const totals = data.reduce(
      (acc, r, i) => {
        // Only include visible investments
        if (investments[i].hidden ?? false) {
          return acc
        }
        const values = getCumulativeValues(r, selectedIndex)
        return {
          currentValue: acc.currentValue + values.currentValue,
          cumulativeInterest: acc.cumulativeInterest + values.cumulativeInterest,
          cumulativeDeposits: acc.cumulativeDeposits + values.cumulativeDeposits,
          cumulativeWithdrawals: acc.cumulativeWithdrawals + values.cumulativeWithdrawals,
          cumulativeFees: acc.cumulativeFees + values.cumulativeFees,
        }
      },
      {
        currentValue: 0,
        cumulativeInterest: 0,
        cumulativeDeposits: 0,
        cumulativeWithdrawals: 0,
        cumulativeFees: 0,
      },
    )

    return [
      totals.currentValue,
      totals.cumulativeInterest,
      totals.cumulativeDeposits,
      -totals.cumulativeWithdrawals,
      -totals.cumulativeFees,
    ]
  })
  const totalValueWithInflation = $derived.by(() => {
    const totals = data.reduce(
      (acc, r, i) => {
        // Only include visible investments
        if (investments[i].hidden ?? false) {
          return acc
        }
        const values = getCumulativeValues(r, selectedIndex, true)
        return {
          currentValue: acc.currentValue + values.currentValue,
          cumulativeInterest: acc.cumulativeInterest + values.cumulativeInterest,
          cumulativeDeposits: acc.cumulativeDeposits + values.cumulativeDeposits,
          cumulativeWithdrawals: acc.cumulativeWithdrawals + values.cumulativeWithdrawals,
          cumulativeFees: acc.cumulativeFees + values.cumulativeFees,
        }
      },
      {
        currentValue: 0,
        cumulativeInterest: 0,
        cumulativeDeposits: 0,
        cumulativeWithdrawals: 0,
        cumulativeFees: 0,
      },
    )

    return [
      totals.currentValue,
      totals.cumulativeInterest,
      totals.cumulativeDeposits,
      -totals.cumulativeWithdrawals,
      -totals.cumulativeFees,
    ]
  })

  function getDateFromGraphLabels(graphLabels: string) {
    const month = graphLabels.includes('-') ? graphLabels : undefined
    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      return new Date(year, monthNum - 1).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      })
    } else {
      return graphLabels
    }
  }
  let tooltipPosition = $state({ x: 0, y: 0 })
  let tooltipData: TooltipData[] = $state([])
  let dataLabels = [
    $_('common.investmentValue'),
    $_('common.interestEarned'),
    $_('common.deposited'),
    $_('common.withdrawn'),
    $_('common.fees'),
  ]
  let tooltipLabels = $derived.by(() => {
    const date = getDateFromGraphLabels(data[0].graphLabels[selectedIndex])
    return [
      $_('common.investmentValueAsOf', { values: { date } }),
      $_('common.totalInterestEarned', { values: { date } }),
      $_('common.totalDeposited', { values: { date } }),
      $_('common.totalWithdrawn', { values: { date } }),
      $_('common.totalFees', { values: { date } }),
    ]
  })
  let totalLabels = [
    $_('common.total'),
    $_('common.total'),
    $_('common.total'),
    $_('common.total'),
    $_('common.total'),
  ]
  let cursorX = $state(0)

  function filterByIndex(i: number) {
    switch (i) {
      case 0:
        return showInvestmentValue
      case 1:
        return showInterestEarned
      case 2:
        return showDeposited
      case 3:
        return showWithdrawn
      case 4:
        return showFees
    }
  }

  function filterLabels() {
    return dataLabels.filter((label, i) => filterByIndex(i))
  }

  function filterChartData() {
    return (adjustWithInflation ? breakdownInflationChartData : breakdownChartData).filter(
      (chartData, i) => filterByIndex(i),
    )
  }
</script>

<Horizontal>
  <div class="doughnut">
    <ChartDoughnut
      data={data.map((d) => {
        const values = getCumulativeValues(d, selectedIndex, adjustWithInflation)
        // Doughnut chart shows the current value of each investment
        return values.currentValue
      })}
      nonInflationData={data.map((d) => {
        const values = getCumulativeValues(d, selectedIndex, false)
        // Non-inflation adjusted values for tooltip display
        return values.currentValue
      })}
      labels={data.map((d) => d.label)}
      {investments}
      currency={portfolio.currency}
      currentYear={getDateFromGraphLabels(data[0].graphLabels[selectedIndex])}
      {birthDate}
      {adjustWithInflation}
    />
  </div>
  <div class="breakdown">
    <Chart
      type="bar"
      labels={filterLabels()}
      datasets={filterChartData()}
      disableHover={disableInteraction}
      options={{
        interaction: disableInteraction
          ? {
              mode: undefined,
            }
          : {
              intersect: false,
              mode: 'nearest',
              axis: 'y',
            },
        elements: {
          point: {
            radius: 0,
          },
        },
        scales: {
          y: {
            stacked: true,
            border: {
              display: false,
            },
            min: 0,
            type: 'category',
          },
          x: {
            stacked: true,
            min: 0,
            ticks: {
              callback: function (value) {
                if (typeof value === 'number') {
                  return new Intl.NumberFormat($locale || undefined).format(value)
                }
                return value
              },
            },
          },
        },
        indexAxis: 'y',
        animation: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: false,
          },
          tooltip: {
            enabled: false,
            external: disableInteraction
              ? undefined
              : (context) => {
                  const { tooltip } = context

                  if (tooltip.opacity === 0) {
                    tooltipData = []
                  } else {
                    tooltipPosition = {
                      x: cursorX,
                      y: tooltip.caretY,
                    }
                    tooltipData = tooltip.dataPoints
                      .filter((d) => d.raw !== 0 && !d?.dataset?.label?.startsWith('_hidden'))
                      .map((d) => {
                        const dataset = d.dataset as CustomDataset<'bar'>
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
                    tooltipPosition.x += tooltipWidth + 16 + tooltipWidth / 2
                  } else {
                    tooltipPosition.x += tooltipWidth / 2 - 48
                  }
                },
          },
        },
      }}
      plugins={disableInteraction
        ? []
        : [
            {
              id: 'cursorPosition',
              beforeEvent(chart, args) {
                const event = args.event

                if (event && event.type === 'mousemove') {
                  cursorX = event.x ?? 0

                  // ✅ Manually trigger external tooltip logic
                  const tooltip = chart.tooltip
                  const external = chart.options.plugins?.tooltip?.external
                  if (external && tooltip && typeof external === 'function') {
                    external.call(tooltip, { chart, tooltip })
                  }
                }
              },
            },

            {
              id: 'horizontalLine',
              afterDraw(chart) {
                const tooltip = chart.tooltip
                if (tooltip && tooltip.opacity > 0) {
                  const ctx = chart.ctx
                  const y = tooltip.caretY
                  const xAxis = chart.scales.x

                  ctx.save()
                  ctx.beginPath()
                  ctx.moveTo(xAxis.left, y)
                  ctx.lineTo(xAxis.right, y)
                  ctx.lineWidth = 1
                  ctx.strokeStyle = 'gray'
                  ctx.stroke()
                  ctx.restore()
                }
              },
            },
          ]}
    />
  </div>
</Horizontal>
<div class="slider">
  <Slider
    withoutShowValue
    dimension="compact"
    alwaysShowValue
    min={0}
    max={data[0]?.graphLabels.length - 1}
    bind:value={selectedIndex}
  ></Slider>
  <div class="date">
    <Typography variant="small" font="mono"
      >{getDateFromGraphLabels(data[0].graphLabels[selectedIndex])}</Typography
    >
  </div>
</div>
<TooltipBreakdownBar
  dataLabels={tooltipLabels}
  {totalLabels}
  {tooltipData}
  {tooltipPosition}
  {adjustWithInflation}
  currency={portfolio.currency}
  {totalValue}
  {totalValueWithInflation}
  year={(() => {
    const label = data[0].graphLabels[selectedIndex]
    if (label.includes('-')) {
      // Format: "2024-1" -> extract year
      return parseInt(label.split('-')[0], 10)
    } else {
      // Format: "2024" -> direct year
      return parseInt(label, 10)
    }
  })()}
  {birthDate}
  disabled={disableInteraction}
/>

<style>
  :root {
    --doughnut-size: 120px;
  }
  .date {
    display: flex;
    justify-content: end;
    align-items: center;
    width: 30px;
  }
  .doughnut {
    width: var(--doughnut-size);
    height: var(--doughnut-size);
  }
  .breakdown {
    width: calc(100% - var(--doughnut-size) - var(--padding));
    display: flex;
    flex-direction: column;
  }
  .slider {
    display: flex;
    align-items: center right;
  }
</style>
