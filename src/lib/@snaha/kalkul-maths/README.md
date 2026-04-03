# Kalkul Math Library

A comprehensive TypeScript library for financial portfolio calculations with support for complex fee structures, compound interest, and time-based analysis.

## Overview

The Kalkul Math Library provides precise financial calculations using [Decimal.js](https://github.com/MikeMcl/decimal.js/) for monetary precision. It's designed for portfolio management applications that need accurate investment value calculations over time.

## Features

- 📊 **Investment Value Calculations** - Calculate current and historical investment values
- 💰 **Complex Fee Support** - Entry, exit, management, success, and TER fees
- 📈 **Portfolio Analytics** - Multi-investment portfolio calculations
- 🎯 **High Precision** - Uses Decimal.js for financial precision
- 📅 **Time-based Analysis** - Monthly and yearly breakdowns
- 🔄 **Transaction Processing** - Handle deposits, withdrawals, and recurring transactions
- 📊 **Visualization Data** - Generate graph-ready data with inflation adjustments

## Installation

```bash
npm install @snaha/kalkul-maths
# or
yarn add @snaha/kalkul-maths
# or
pnpm add @snaha/kalkul-maths
```

## Quick Start

```typescript
import {
  createTransactionMap,
  getCurrentInvestmentValue,
  getInvestmentValues,
} from '@snaha/kalkul-maths'

// Create transaction data
const transactions = [
  {
    type: 'deposit',
    amount: 1000,
    date: '2024-01-01',
    end_date: null,
    repeat: null,
    repeat_unit: null,
  },
]

// Define investment parameters
const investment = {
  apy: 8, // 8% annual return
  entry_fee: 1, // 1% entry fee
  entry_fee_type: 'ongoing',
  // ... other investment properties
}

// Calculate current value
const baseData = getBaseData(transactions)
const currentValue = getCurrentInvestmentValue(baseData, investment)

console.log(`Current investment value: ${currentValue}`)
```

## Core Modules

### Investment Calculations

Calculate investment values with complex fee structures and compound growth.

```typescript
import { getCurrentInvestmentValue, getInvestmentValues } from '@snaha/kalkul-maths'

// Get current investment value as of today
const currentValue = getCurrentInvestmentValue(baseData, investment)

// Get historical values by period (monthly/yearly)
const { investmentValues, feeValues } = getInvestmentValues(
  { period: 'month', count: 1 },
  baseData,
  investment,
)
```

### Fee Calculations

Support for various fee types and structures.

```typescript
import { calculateEntryFee, calculateExitFee } from '@snaha/kalkul-maths'

// Entry fees: ongoing, upfront, or forty-sixty
const entryFee = calculateEntryFee(1000, 'ongoing', 0.02, 10000, 0)

// Exit fees: percentage or fixed
const exitFee = calculateExitFee(500, 'percentage', 0.015)
```

### Transaction Processing

Handle various transaction types and recurring patterns.

```typescript
import { calculateTotalAmount, createTransactionMap } from '@snaha/kalkul-maths'

const transactions = [
  {
    type: 'deposit',
    amount: 1000,
    date: '2024-01-01',
    repeat: 1,
    repeat_unit: 'month',
    end_date: '2024-12-31',
  },
]

// Create optimized transaction maps
const deposits = createTransactionMap(transactions.filter((t) => t.type === 'deposit'))
const withdrawals = createTransactionMap(transactions.filter((t) => t.type === 'withdrawal'))
```

### Graph Data Generation

Generate visualization-ready data with inflation adjustments.

```typescript
import { getGraphData, getGraphDataForPortfolio } from '@snaha/kalkul-maths'

// Single investment graph data
const graphData = getGraphData(baseData, investment, portfolio)

// Portfolio-wide graph data (portfolio includes nested investments)
const { total, data } = getGraphDataForPortfolio(portfolio)
```

## Investment Configuration

```typescript
interface Investment {
  apy: number // Annual percentage yield
  entry_fee: number // Entry fee percentage/amount
  entry_fee_type: 'ongoing' | 'upfront' | 'forty-sixty'
  exit_fee: number // Exit fee percentage/amount
  exit_fee_type: 'percentage' | 'fixed'
  management_fee: number // Management fee percentage/amount
  management_fee_type: 'percentage' | 'fixed'
  success_fee: number // Success fee percentage
  ter: number | null // Total expense ratio
  // ... other properties
}
```

## Fee Types Explained

### Entry Fees

- **`ongoing`** - Fee applied to each deposit (amount × fee)
- **`upfront`** - Total fee paid upfront from deposits until fully paid
- **`forty-sixty`** - 60% of deposit amount until total fee target reached

### Exit Fees

- **`percentage`** - Percentage of withdrawal amount
- **`fixed`** - Fixed fee amount per withdrawal

### Management Fees

- **`percentage`** - Annual percentage of portfolio value
- **`fixed`** - Fixed annual amount

## Transaction Types

```typescript
interface Transaction {
  type: 'deposit' | 'withdrawal'
  amount: number
  date: string // YYYY-MM-DD format
  end_date?: string | null // For recurring transactions
  repeat?: number | null // Repeat interval
  repeat_unit?: 'day' | 'week' | 'month' | 'year' | null
}
```

## Examples

### Basic Investment Calculation

```typescript
import { getBaseData, getCurrentInvestmentValue } from '@snaha/kalkul-maths'

const transactions = [
  {
    type: 'deposit',
    amount: 10000,
    date: '2024-01-01',
    end_date: null,
    repeat: null,
    repeat_unit: null,
  },
]

const investment = {
  apy: 7,
  entry_fee: 0,
  exit_fee: 0,
  management_fee: 1.5,
  management_fee_type: 'percentage',
  success_fee: 0,
  ter: null,
  // ... required properties
}

const baseData = getBaseData(transactions)
const valueAfterOneYear = getCurrentInvestmentValue(baseData, investment, new Date('2025-01-01'))

console.log(`Value after one year: ${valueAfterOneYear}`)
// Output: Value after one year: 10545.73 (7% growth - 1.5% management fee)
```

### Monthly Investment Plan

```typescript
const monthlyInvestment = [
  {
    type: 'deposit',
    amount: 1000,
    date: '2024-01-01',
    end_date: '2024-12-31',
    repeat: 1,
    repeat_unit: 'month',
  },
]

const { investmentValues } = getInvestmentValues(
  { period: 'month', count: 1 },
  getBaseData(monthlyInvestment),
  investment,
)

// investmentValues contains end-of-month values for each month
console.log('Monthly portfolio values:', investmentValues)
```

### Portfolio Analysis

```typescript
import { getCurrentPortfolioValue } from '@snaha/kalkul-maths'

// Investments with nested transactions
const investments = [
  {
    id: 1,
    apy: 8,
    transactions: [
      /* ... */
    ],
  },
  {
    id: 2,
    apy: 6,
    transactions: [
      /* ... */
    ],
  },
]

const transactionStore = {
  filter: (investmentId: string) =>
    investments.find((i) => i.id === investmentId)?.transactions ?? [],
}

const totalPortfolioValue = getCurrentPortfolioValue(transactionStore, investments)
console.log(`Total portfolio value: ${totalPortfolioValue}`)
```

## Performance Notes

The library is optimized for typical portfolio calculations (5-20 years). For extreme long-term calculations (80+ years), consider:

- Caching frequently calculated values
- Using lazy evaluation strategies
- Implementing data pagination for large datasets

Typical performance:

- 5-year calculation: ~35ms
- 20-year calculation: ~150ms
- 80-year calculation: ~600ms

## Precision

All monetary calculations use [Decimal.js](https://github.com/MikeMcl/decimal.js/) with 30-digit precision to avoid floating-point arithmetic issues common in financial calculations.

```typescript
// ❌ Avoid native JavaScript numbers for money
const wrong = 0.1 + 0.2 // 0.30000000000000004

// ✅ Use this library's functions
const right = calculateTotalDepositAmount(deposits) // Precise decimal arithmetic
```

## API Reference

### Core Functions

- `getCurrentInvestmentValue(baseData, investment, asOfDate?)` - Current investment value
- `getCurrentPortfolioValue(transactionStore, investments, asOfDate?)` - Total portfolio value
- `getInvestmentValues(periodCount, baseData, investment)` - Historical values by period
- `getBaseData(transactions)` - Convert transactions to calculation format

### Fee Functions

- `calculateEntryFee(amount, type, fee, totalDepositAmount, alreadyPaid)` - Entry fee calculation
- `calculateExitFee(amount, type, fee)` - Exit fee calculation
- `calculateDailyManagementFees(investment, numDaysPerYear)` - Management fee calculation
- `calculateDailyFees(fee, feeType, numDaysPerYear)` - Generic daily fee calculation

### Utility Functions

- `createTransactionMap(transactions)` - Optimize transactions for calculations
- `calculateTotalDepositAmount(deposits)` - Sum total deposits
- `calculateTotalAmount(transactions, type)` - Sum transactions by type
- `formatDate(date)` - Format date for calculations
- `incrementDate(date, period, count)` - Date arithmetic

### Graph Functions

- `getGraphData(baseData, investment, portfolio)` - Single investment graph data
- `getGraphDataForPortfolio(transactionStore, investments, portfolio)` - Portfolio graph data
- `getRateAdjustment(rate, period, count)` - Rate calculations for periods

## TypeScript Support

The library is written in TypeScript and provides full type definitions:

```typescript
import type {
  FeeBreakdown,
  GraphData,
  Investment,
  InvestmentData,
  Transaction,
  TransactionMap,
} from '@snaha/kalkul-maths'
```

## Testing

The library includes comprehensive tests covering:

- ✅ Investment value calculations (29 tests)
- ✅ Fee calculations (12 tests)
- ✅ Boundary conditions (6 tests)
- ✅ Utility functions (3 tests)
- ✅ Transaction processing (11 tests)
- ✅ Date utilities (5 tests)

Run tests:

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Note**: This library prioritizes accuracy over performance. For high-frequency trading or real-time applications, consider the performance characteristics and implement appropriate caching strategies.
