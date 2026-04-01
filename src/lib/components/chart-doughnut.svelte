<script lang="ts">
  import { untrack } from 'svelte'
  import { SERIES_COLORS } from '$lib/colors'
  import { getCSSVariableValue } from '$lib/css-vars'
  import type { InvestmentWithColorIndex, TooltipData } from '$lib/types'
  import Chart, { type ChartDataset, type ChartOptions } from 'chart.js/auto'
  import TooltipBreakdownDoughnut from './tooltip-breakdown-doughnut.svelte'

  interface Props {
    data: number[]
    nonInflationData?: number[]
    labels: string[]
    investments: InvestmentWithColorIndex[]
    currency?: string
    currentYear?: string
    birthDate?: Date
    adjustWithInflation: boolean
  }

  Chart.defaults.font.family = getCSSVariableValue('--font-family-sans-serif')
  Chart.defaults.borderColor = getCSSVariableValue('--colors-low')
  Chart.defaults.color = getCSSVariableValue('--colors-high-neutral')

  const DEFAULT_OPTIONS: ChartOptions<'doughnut'> = {
    maintainAspectRatio: false,
    responsive: false,
    interaction: {
      intersect: true,
      mode: 'point',
    },
    elements: {
      point: {
        radius: 0,
      },
    },
  }

  let {
    data,
    nonInflationData,
    labels,
    investments,
    currency = 'USD',
    currentYear = '',
    birthDate,
    adjustWithInflation,
  }: Props = $props()

  let tooltipData: TooltipData[] = $state([])
  let tooltipPosition = $state({ x: 0, y: 0 })

  const doughnutData = $derived.by(() => {
    return data
      .map((value, i) => ({
        value,
        nonInflationValue: nonInflationData?.[i] ?? value,
        label: labels[i],
        colorIndex: investments[i].colorIndex ?? i,
      }))
      .filter((item) => item.value > 0)
  })

  let canvas: HTMLCanvasElement | null = $state(null)
  let chart: Chart | null = $state(null)

  const isEmpty = $derived(data.every((d) => d === 0))

  function setDataset(): ChartDataset<'doughnut'> {
    const visibleData = data.filter((_, i) => !(investments[i].hidden ?? false))

    const visibleColors = data.reduce<string[]>((acc, _, i) => {
      if (!(investments[i].hidden ?? false)) {
        const colorIndex = investments[i].colorIndex ?? i % SERIES_COLORS.length
        acc.push(SERIES_COLORS[colorIndex])
      }
      return acc
    }, [])
    if (isEmpty) {
      return {
        data: [1],
        backgroundColor: 'grey',
        hoverBackgroundColor: 'grey',
        borderWidth: 0,
      }
    } else {
      return {
        data: visibleData,
        backgroundColor: visibleColors,
        hoverBorderWidth: 1,
        hoverBorderColor: Chart.defaults.borderColor,
      }
    }
  }

  $effect(() => {
    if (canvas && !chart) {
      chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [setDataset()],
        },
        options: {
          ...DEFAULT_OPTIONS,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: false,
              external: (context) => {
                const { tooltip } = context
                if (tooltip.opacity === 0) {
                  tooltipData = []
                } else {
                  // Fixed position: 16px to the right of the chart, aligned with top
                  // Adjust for TooltipBase centering: add tooltip width to x, adjust y to align top
                  tooltipPosition = {
                    x: context.chart.width + 16 + 321, // 321 is tooltip width
                    y: 0, // Add approximate half tooltip height to compensate for -50% centering
                  }
                  tooltipData = tooltip.dataPoints.map((d) => ({
                    dataIndex: d.dataIndex,
                    value: d.raw as number,
                    name: d.label,
                    colorIndex: investments[d.dataIndex]?.colorIndex ?? d.dataIndex,
                  }))
                }
              },
            },
          },
          animation: false,
        },
      })
      // Wrap Chart.js method calls in untrack() to prevent infinite reactive loops
      untrack(() => {
        chart?.resize()
      })
    }
    if (chart) {
      // Track reactive dependencies but untrack Chart.js operations
      untrack(() => {
        if (chart) {
          chart.data.labels = labels
          chart.data.datasets = [setDataset()]
          if (chart.options.plugins && chart.options.plugins.tooltip) {
            chart.options.plugins.tooltip.enabled = false
            chart.options.plugins.tooltip.external = (context) => {
              const { tooltip } = context
              if (tooltip.opacity === 0) {
                tooltipData = []
              } else {
                // Fixed position: 16px to the right of the chart, aligned with top
                // Adjust for TooltipBase centering: add tooltip width to x, adjust y to align top
                tooltipPosition = {
                  x: context.chart.width + 16 + 321, // 321 is tooltip width
                  y: 0, // Add approximate half tooltip height to compensate for -50% centering
                }
                tooltipData = tooltip.dataPoints.map((d) => ({
                  dataIndex: d.dataIndex,
                  value: d.raw as number,
                  name: d.label,
                  colorIndex: investments[d.dataIndex]?.colorIndex ?? d.dataIndex,
                }))
              }
            }
          }

          chart.update()
        }
      })
    }
  })
  let prevChartWidth: number = $state(0)
  let actChartWidth: number = $state(0)
  let actChartHeight: number = $state(0)
  let prevChartHeight: number = $state(0)
  $effect(() => {
    const interval = setInterval(() => {
      if ((actChartWidth !== prevChartWidth || actChartHeight !== prevChartHeight) && chart) {
        prevChartHeight = actChartHeight
        prevChartWidth = actChartWidth
        // Wrap Chart.js resize() in untrack() to prevent reactive loops
        untrack(() => {
          chart?.resize()
        })
      }
    }, 500)
    return () => {
      clearInterval(interval)
    }
  })
</script>

<div class="chart" bind:clientWidth={actChartWidth} bind:clientHeight={actChartHeight}>
  <canvas bind:this={canvas}></canvas>
</div>
<TooltipBreakdownDoughnut
  {tooltipData}
  {tooltipPosition}
  {currency}
  {doughnutData}
  year={parseInt(currentYear, 10)}
  {birthDate}
  {adjustWithInflation}
/>

<style>
  .chart {
    width: 100%;
    height: 100%;
  }
</style>
