---
title: Monthly growth and cash-flow engine
description: Version-one calculation contract, headless API, financial assumptions, and numerical limitations.
---

## Milestone-one contract

The first milestone is a deterministic growth and cash-flow engine with two-scenario
worksheets. The same validated engine runs without React, a browser, storage, networking,
or AI. Future AI tools may call it through an adapter; no AI service is implemented here.

Confirmed conventions:

- Monthly calculations and annual summaries
- Selectable beginning- or end-of-month cash flows, defaulting to end
- Contributions followed by withdrawals at the selected point in each month
- Fixed nominal monthly contributions and requested withdrawals
- Withdraw only available funds, report the shortfall, and continue
- Effective annual return converted to its equivalent monthly rate
- Separate fund expense and additional advisory/account fee inputs
- An explicit return basis to prevent deducting fund expenses twice
- Round monthly growth and fee amounts to cents
- Add changing life phases after this milestone, not within version one

## Inputs and validation

Money is expressed as nonnegative integer USD cents, never locale-formatted strings.
Rates are decimal fractions: `0.06` means 6%, not `6`. The worksheet converts user-facing
dollar and percentage inputs before calling the engine.

The engine accepts 0 to 1,200 whole months (up to 100 projection years). This is an
execution limit for browser and future tool callers, not an investment assumption.
Amounts must be safe integers. Return must be at least -100%; inflation must exceed
-100%. Each annual fee percentage must be between 0% and 100%. All numbers must be
finite. Unknown fields and unsupported enum values are rejected.

Invalid inputs return structured field errors. A calculation exceeding the supported
numeric range returns an explicit calculation error, not a partial or infinite result.

## Monthly event order

1. Record the opening balance.
2. For beginning-of-month timing, add the contribution and fund the requested withdrawal.
3. Apply growth to the remaining balance using `(1 + annualReturn)^(1/12) - 1`.
4. Compute both fee categories from that same post-growth balance.
5. Deduct the rounded fee amounts.
6. For end-of-month timing, add the contribution and fund the requested withdrawal.
7. Record the closing balance and its inflation-adjusted purchasing power.

Each fee category uses `annualFeeRate / 12`. Fund expenses are deducted only when the
return basis is `before-fund-expenses`. Additional advisory/account fees are always
modeled separately; the return assumption must be before those additional fees.

This monthly fee model is an approximation. Real funds commonly reflect operating
expenses in daily net asset value, and advisors may bill quarterly using different
valuation bases, tiers, or minimums. Version one does not reproduce those billing rules.

Unmet withdrawals are reported but are not carried forward as debt or arrears.
Future contributions can fund future withdrawals after depletion.

## Avoid double-counting fund expenses

Fund pages and prospectuses commonly publish annual expense ratios. Gross ratios are
before waivers; net ratios reflect applicable waivers or reimbursements. A waiver may
expire, so the selected ratio and its applicability need review.

Published fund returns generally already reflect operating expenses. If using such a
return assumption, select `after-fund-expenses`. A zero additional fund-fee deduction
then means the expenses are included in the return, not that the investment is free.

See [Fidelity's expense-ratio explanation](https://www.fidelity.com/learning-center/smart-money/expense-ratio).
Use synthetic examples in documentation and do not upload actual statements to this repo.

## Rounding and uncertainty

Round growth and each fee category to the nearest cent, with half-cent ties away from
zero. Integer-cent ledger entries reconcile exactly within the supported numeric range.
Inflation-adjusted growth and ending values are rounded separately for reporting;
they are not additional cash flows.

This choice favors understandable statements over carrying fractional cents indefinitely.
Rounding can accumulate and compound over long horizons. We do not claim a universal
error bound or that the final value equals a broker's calculation. Floating-point rate
conversion also introduces numerical approximation.

Returns and inflation are user-supplied, constant scenario assumptions, not forecasts.
Real market paths, inflation, fees, and cash-flow dates will differ. Version one does
not estimate probabilities, taxes, benefit rules, transaction costs, or investment advice.
It cannot rank a scenario as universally better.

## Outputs and summaries

Every monthly row exposes opening balance, contributions, requested and funded
withdrawals, shortfall, growth, fund-fee deductions, additional fees, closing balance,
inflation-adjusted growth, and inflation-adjusted closing balance.

Annual summaries group months 1-12, 13-24, and so on. These are projection years, not
calendar or tax years. Include a final partial year. Sum cash flows, growth, and fees;
use the first opening and last closing balances rather than summing balances.

The result includes the copied input assumptions, engine version, first shortfall
month, monthly ledger, annual summaries, and totals. Identical inputs produce identical
results. No input is mutated, stored, logged, or sent over a network.

### Today's-dollar growth

Engine `growth-1.1.0` adds `realGrowthCents` to monthly, annual, and total outputs.
Existing nominal calculations are unchanged. For projection month `m`, divide that
month's already rounded nominal growth by `(1 + annualInflationRate)^(m/12)`, then
round to cents using the same half-away-from-zero convention. Annual and total real
growth sum these rounded monthly values. Do not discount a cumulative nominal
growth total using only the final month's inflation factor.

Growth remains investment growth before separately modeled fee deductions. If the
return input already includes fund expenses, those embedded expenses remain included.
Real growth here measures the purchasing power of the monthly growth amounts. It is
not a real rate of return, nor the change in purchasing power of the entire balance.
Inflation erosion of the opening capital is reflected in real closing balances, not
subtracted from `realGrowthCents`.

With a synthetic $100 start, 10% monthly return and 10% monthly inflation, nominal
growth is $10 in month one and $11 in month two. Their today's-dollar values are
$9.09 and $9.09, for $18.18 total. The real closing balance remains $100.
This intentionally differs from both the $21 nominal growth and the $0 change in
real closing balance. These exaggerated rates illustrate the convention, not an outlook.

Negative growth retains its sign. Deflation can increase the magnitude of real
amounts. If real growth or its aggregate exceeds safe integer cents, the entire
projection returns the same explicit numeric-range error as other unsupported
calculations, even if the nominal closing balance would fit.

### Comparing alternative scenarios

The comparison reports B minus A, never an A-plus-B total. `compareAmounts` is a
headless helper exported alongside the engine. It accepts signed safe-integer cents
and returns the amount difference and a fractional relative difference, or an
explicit error if the difference is outside the supported integer-cent range.
For a positive A value, the relative difference is `(B - A) / A`. For zero or
negative A, it returns `null` for the relative difference, displayed as N/A. An
overflowed difference is reported in the table, not substituted with zero.
First-shortfall months are shown as events, without monetary or percentage deltas.

Positive differences are not automatically favorable: higher fees or unfunded
withdrawals can be undesirable. All summary values are nominal USD unless explicitly
labeled as today's dollars. Each scenario uses its own inflation assumption; both
use the same starting-period purchasing-power reference.

### Chart and ledger conventions

The comparison chart plots both scenarios over the complete horizon using monthly
points, including month zero. Switch between closing balance and cumulative growth,
and independently choose nominal or today's dollars. Its exact-data table exposes
the plotted values. A zero-month projection has only the starting balance, or zero
cumulative growth, with no fabricated future periods.

Ledgers remain vertically stacked, with shared Yearly/Monthly tabs and a clearly
selected tab linked to its ledger panel. Growth in a
ledger is for that row's period, not cumulative. The compact view shows period,
nominal growth, and nominal closing balance. Optional column groups add opening
balance/cash flows, fee deductions, and supplementary today's-dollar growth/closing.
The nominal columns retain their original reconciliation; supplementary real-dollar
values are not additional transactions and must not be added to that reconciliation.

Monthly navigation uses a whole-year slider and a compact row containing a three-digit
exact-year input plus labeled Previous, Next, and Go icon buttons. The selected year
is bounded by the projection's actual years, including partial years.
There is no year navigator when duration is zero. Changing display options never
recalculates financial assumptions. Editing an assumption removes stale results
until the next comparison; recalculation resets the selected year to one.

## Worked synthetic examples

With a $100 starting balance, a $10 contribution, no fees, and a return assumption
equivalent to 1% per month:

- End-of-month contribution: $100 + $1 growth + $10 contribution = $111
- Beginning-of-month contribution: $110 + $1.10 growth = $111.10

With $10,000, no growth or cash flows, a 0.20% annual fund expense ratio and 1% annual
additional fee, the modeled first-month deductions are $1.67 and $8.33. A before-fund-expense
return therefore leaves $9,990. An after-fund-expense return deducts only the additional
$8.33, leaving $9,991.67. These examples illustrate the rules, not typical fees or forecasts.

Starting with $100 and requesting $60 each month at zero return and no fees funds $60
in month one, $40 in month two, and $0 in month three. The shortfalls are $0, $20, and
$60 respectively. Each month is reported; no debt is created.

## Headless use

Import `runGrowthProjection` and `GrowthInput` from `src/domain/growth/index.ts`
using a TypeScript-capable build or runtime. The worksheet is one consumer, not the
owner of the calculation. Inputs and outputs are JSON-compatible.

```typescript
import {
  runGrowthProjection,
  type GrowthInput,
} from './src/domain/growth/index'

const input: GrowthInput = {
  startingBalanceCents: 1_000_000,
  monthlyContributionCents: 25_000,
  monthlyWithdrawalCents: 0,
  months: 120,
  annualReturnRate: 0.05,
  annualInflationRate: 0.02,
  annualFundExpenseRatio: 0.002,
  annualAdvisoryFeeRate: 0,
  returnBasis: 'after-fund-expenses',
  cashFlowTiming: 'end',
}

const outcome = runGrowthProjection(input)
if (!outcome.ok) {
  // The caller must surface these errors; do not substitute a zero result.
  console.error(outcome.errors)
} else {
  console.log(outcome.projection.annual)
}
```

The current public module is not yet a separately published package, CLI, API endpoint,
or AI tool. Those adapters can share this contract without reimplementing the formulas.
