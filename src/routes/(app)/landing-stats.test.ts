import { describe, expect, test } from 'vitest'

import type { YearlyProjection } from '$lib/plan-projection'

import { getFirstUnfundedYear, getProjectionStats, getStatsDelta } from './landing-stats'

/** A projection row with only the fields these readings look at filled in. */
function year(
  value: Pick<YearlyProjection, 'year' | 'cash' | 'netWorth'> & {
    fiPercent?: number
    insufficientFundTransferIds?: string[]
    insufficientFundAssetIds?: string[]
    insufficientFundExpenseIds?: string[]
  },
): YearlyProjection {
  return {
    investments: 0,
    tangibleAssets: 0,
    liabilities: 0,
    investmentsByItem: [],
    tangibleAssetsByItem: [],
    liabilitiesByItem: [],
    totalIncome: 0,
    totalExpenses: 0,
    insufficientFundTransferIds: [],
    insufficientFundAssetIds: [],
    insufficientFundExpenseIds: [],
    ...value,
  }
}

const BIRTH_YEAR = 1986

// Born 1986, so 65 falls in 2051.
const YEARS = [
  year({ year: 2049, cash: 8_000, netWorth: 900_000, fiPercent: 80 }),
  year({ year: 2050, cash: 5_000, netWorth: 980_000, fiPercent: 104 }),
  year({ year: 2051, cash: 9_000, netWorth: 1_060_000, fiPercent: 130 }),
  year({ year: 2052, cash: 12_000, netWorth: 1_140_000, fiPercent: 160 }),
]

describe('getProjectionStats', () => {
  test('reads net worth off the year the person turns 65', () => {
    expect(getProjectionStats(YEARS, BIRTH_YEAR).netWorthAtHeadlineAge).toBe(1_060_000)
  })

  test('leaves net worth at 65 undefined when the projection stops short', () => {
    const short = YEARS.slice(0, 2)
    expect(getProjectionStats(short, BIRTH_YEAR).netWorthAtHeadlineAge).toBe(undefined)
  })

  test('reports the age in the first year independence is reached', () => {
    expect(getProjectionStats(YEARS, BIRTH_YEAR).independentAtAge).toBe(64)
  })

  test('counts exactly 100 percent as independent', () => {
    const exact = [year({ year: 2040, cash: 1_000, netWorth: 10, fiPercent: 100 })]
    expect(getProjectionStats(exact, BIRTH_YEAR).independentAtAge).toBe(54)
  })

  test('leaves the age undefined when independence is never reached', () => {
    const never = YEARS.map((row) => ({ ...row, fiPercent: 40 }))
    expect(getProjectionStats(never, BIRTH_YEAR).independentAtAge).toBe(undefined)
  })

  test('skips years with no fiPercent instead of treating them as reached', () => {
    const missing = [
      year({ year: 2040, cash: 1_000, netWorth: 10 }),
      year({ year: 2041, cash: 1_000, netWorth: 10, fiPercent: 120 }),
    ]
    expect(getProjectionStats(missing, BIRTH_YEAR).independentAtAge).toBe(55)
  })

  test('finds the lowest cash and the year it falls in', () => {
    expect(getProjectionStats(YEARS, BIRTH_YEAR).lowestCash).toEqual({ year: 2050, value: 5_000 })
  })

  test('names the earliest year when the low is reached more than once', () => {
    const tied = [
      year({ year: 2030, cash: 4_000, netWorth: 10 }),
      year({ year: 2031, cash: 2_000, netWorth: 10 }),
      year({ year: 2032, cash: 2_000, netWorth: 10 }),
    ]
    expect(getProjectionStats(tied, BIRTH_YEAR).lowestCash).toEqual({ year: 2031, value: 2_000 })
  })

  test('returns nothing at all for an empty projection', () => {
    expect(getProjectionStats([], BIRTH_YEAR)).toEqual({
      netWorthAtHeadlineAge: undefined,
      independentAtAge: undefined,
      lowestCash: undefined,
    })
  })
})

describe('getStatsDelta', () => {
  const base = getProjectionStats(YEARS, BIRTH_YEAR)

  test('measures the plan against the current course', () => {
    const plan = getProjectionStats(
      [
        year({ year: 2049, cash: 3_000, netWorth: 900_000, fiPercent: 80 }),
        year({ year: 2050, cash: 4_000, netWorth: 980_000, fiPercent: 90 }),
        year({ year: 2051, cash: 9_500, netWorth: 1_200_000, fiPercent: 130 }),
      ],
      BIRTH_YEAR,
    )

    expect(getStatsDelta(plan, base)).toEqual({
      netWorthAtHeadlineAge: 140_000,
      independentAtAge: 1,
      lowestCash: -2_000,
    })
  })

  test('reports no difference as zero rather than as missing', () => {
    expect(getStatsDelta(base, base)).toEqual({
      netWorthAtHeadlineAge: 0,
      independentAtAge: 0,
      lowestCash: 0,
    })
  })

  test('leaves a difference undefined when either side lacks the figure', () => {
    const short = getProjectionStats(YEARS.slice(0, 2), BIRTH_YEAR)
    expect(getStatsDelta(short, base)).toEqual({
      netWorthAtHeadlineAge: undefined,
      independentAtAge: 0,
      lowestCash: 0,
    })
  })
})

describe('getFirstUnfundedYear', () => {
  test('finds the first year the engine flagged, whatever the reason', () => {
    const years = [
      year({ year: 2030, cash: 100, netWorth: 1 }),
      year({ year: 2031, cash: 0, netWorth: 1, insufficientFundExpenseIds: ['exp-1', 'exp-2'] }),
      year({ year: 2032, cash: 0, netWorth: 1, insufficientFundTransferIds: ['tr-1'] }),
    ]
    expect(getFirstUnfundedYear(years)).toBe(2031)
  })

  test('counts a skipped purchase and a skipped transfer too', () => {
    expect(
      getFirstUnfundedYear([
        year({ year: 2040, cash: 0, netWorth: 1, insufficientFundAssetIds: ['ta-4'] }),
      ]),
    ).toBe(2040)
    expect(
      getFirstUnfundedYear([
        year({ year: 2041, cash: 0, netWorth: 1, insufficientFundTransferIds: ['tr-1'] }),
      ]),
    ).toBe(2041)
  })

  test('is undefined for a projection that pays for itself throughout', () => {
    expect(getFirstUnfundedYear(YEARS)).toBe(undefined)
    expect(getFirstUnfundedYear([])).toBe(undefined)
  })
})
