# Kalkul Math Library

Shared low-level helpers for Kalkul's financial calculations. All monetary
arithmetic in the app uses [Decimal.js](https://github.com/MikeMcl/decimal.js/)
to avoid floating-point errors; this package hosts the shared building blocks.

The legacy graph/simulation pipeline (investment values, fee schedules,
transaction maps, graph data) was removed together with the nested
portfolio→investments→transactions data model it served. The live projection
engine is `src/lib/plan-projection.ts`, which computes yearly plan projections
from the profile-based model (`profileInvestmentSchema` and friends in
`src/lib/schemas.ts`).

## API

### Constants (`constants.ts`)

- `DECIMAL_0`, `DECIMAL_1` — shared `Decimal` instances for common values

### Date utilities (`date.ts`)

- `formatDate(date)` — format a `Date` as `yyyy-MM-dd` (the app's canonical
  date-only string format)

## Usage

```typescript
import { DECIMAL_0, DECIMAL_1, formatDate } from '$lib/@snaha/kalkul-maths'
```

## Precision

```typescript
// ❌ Avoid native JavaScript numbers for money
const wrong = 0.1 + 0.2 // 0.30000000000000004

// ✅ Use Decimal.js
const right = new Decimal(0.1).plus(0.2) // 0.3
```

New financial math shared across features should live in this package with
unit tests alongside the source.
