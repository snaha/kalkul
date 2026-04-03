import type { GraphData } from '$lib/@snaha/kalkul-maths'
import {
  aggregateGraphData,
  calculateDateRange,
  generateGraphDateLabels,
  getGraphData,
  getSamplingPeriodCount,
  prepareInvestmentBaseData,
} from '$lib/@snaha/kalkul-maths'
import type { PortfolioNested } from '$lib/types'

export interface PortfolioSimulation {
  data: GraphData[]
  total: GraphData
  isCalculating?: boolean
  progress?: number
  currentCalculatingIndex?: number
}

/**
 * Creates an empty GraphData structure with all values initialized to zero
 */
function createEmptyGraphData(label: string, graphLabels: string[]): GraphData {
  const emptyArray = new Array(graphLabels.length).fill(0)
  return {
    label,
    graphLabels: [...graphLabels],
    graphDeposits: [...emptyArray],
    graphWithdrawals: [...emptyArray],
    graphInvestmentValues: [...emptyArray],
    graphFeeValues: [...emptyArray],
    graphInflationDeposits: [...emptyArray],
    graphInflationWithdrawals: [...emptyArray],
    graphInflationInvestmentValues: [...emptyArray],
    graphInflationFeeValues: [...emptyArray],
  }
}

interface PortfolioSimulationStore {
  /**
   * Current simulation data including graph data for all investments and progress state
   */
  get simulationData(): PortfolioSimulation

  /**
   * Calculates portfolio simulation iteratively, processing one investment at a time
   * to keep the UI responsive. Updates are progressive - the UI updates after each
   * investment is calculated.
   *
   * @param portfolio - Portfolio with nested investments
   */
  calculateIteratively: (portfolio: PortfolioNested) => void
}

/**
 * Creates a portfolio simulation store that manages progressive calculation state.
 *
 * Calculations are performed iteratively, processing one investment at a time while
 * yielding to the browser between each to keep the UI responsive.
 *
 * @returns Portfolio simulation store with reactive simulation data and calculation method
 */
export function withPortfolioSimulationStore(): PortfolioSimulationStore {
  let simulationData = $state<PortfolioSimulation>({
    data: [],
    total: createEmptyGraphData('Total', []),
    isCalculating: true,
    progress: 0,
  })
  let calculationQueue:
    | {
        portfolio: PortfolioNested
        currentIndex: number
        accumulatedTotal: GraphData | undefined
        baseData: ReturnType<typeof prepareInvestmentBaseData>
        startDate: Date
        endDate: Date
      }
    | undefined = undefined

  function processNextInvestment() {
    if (!calculationQueue) return

    const queue = calculationQueue
    const currentIndex = queue.currentIndex

    if (currentIndex >= queue.portfolio.investments.length) {
      simulationData = {
        ...simulationData,
        isCalculating: false,
        progress: 100,
      }
      calculationQueue = undefined
      return
    }

    // Calculate graph data for current investment
    const d = queue.baseData[currentIndex]
    const investmentData = d.baseData
    investmentData.startDate = queue.startDate
    investmentData.endDate = queue.endDate
    const graphData = getGraphData(investmentData, d.investment, queue.portfolio)

    // Update investment data at current index (mutate in place for performance)
    simulationData.data[currentIndex] = graphData

    // Build array of all calculated investments so far
    const calculatedInvestments = simulationData.data.slice(0, currentIndex + 1)

    // Aggregate all calculated investments to get current total
    // This uses the same aggregation logic as getGraphDataForPortfolio
    queue.accumulatedTotal = aggregateGraphData(calculatedInvestments)

    // Update simulation data with current progress
    const progress = Math.round(((currentIndex + 1) / queue.portfolio.investments.length) * 100)
    const isLastIteration = currentIndex + 1 >= queue.portfolio.investments.length

    simulationData = {
      data: simulationData.data,
      total: queue.accumulatedTotal,
      isCalculating: !isLastIteration,
      progress,
      currentCalculatingIndex: isLastIteration ? undefined : queue.currentIndex,
    }

    queue.currentIndex++

    // Schedule next investment calculation
    // setTimeout with 0 delay yields to browser between each investment calculation,
    // allowing the UI to update progressively and remain responsive
    if (queue.currentIndex < queue.portfolio.investments.length) {
      setTimeout(processNextInvestment, 0)
    }
  }

  return {
    get simulationData() {
      return simulationData
    },

    calculateIteratively(portfolio: PortfolioNested) {
      // Reset state for new calculation
      calculationQueue = undefined

      if (portfolio.investments.length === 0) {
        simulationData = {
          data: [],
          total: createEmptyGraphData('Total', []),
          isCalculating: false,
          progress: 100,
        }
        return
      }

      // Prepare base calculation data for all investments
      const baseData = prepareInvestmentBaseData(portfolio)

      // Calculate overall date range from all investments
      const { startDate, endDate } = calculateDateRange(baseData, portfolio)

      // Create empty placeholder data for all investments
      const { period, count } = getSamplingPeriodCount(startDate, endDate)
      const graphLabels = generateGraphDateLabels(startDate, endDate, period, count)

      const emptyGraphData: GraphData[] = portfolio.investments.map((inv) =>
        createEmptyGraphData(inv.name, graphLabels),
      )

      calculationQueue = {
        portfolio,
        currentIndex: 0,
        accumulatedTotal: undefined,
        baseData,
        startDate,
        endDate,
      }

      // Set calculating state and empty data in a single update
      // This ensures the loading overlay appears at the same time as the data changes
      simulationData = {
        data: emptyGraphData,
        total: createEmptyGraphData('Total', graphLabels),
        isCalculating: true,
        progress: 0,
      }

      // Start processing immediately to minimize the time showing empty data
      setTimeout(processNextInvestment, 0)
    },
  }
}
