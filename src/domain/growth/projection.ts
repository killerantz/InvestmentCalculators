import type {
  AnnualRow,
  LedgerAmounts,
  MonthlyRow,
  ProjectionOutcome,
  ValidationIssue,
} from './types'
import { validateGrowthInput } from './validation'
import {
  cents,
  effectiveMonthlyRate,
  inflationFactor,
  NumericRangeError,
} from '../numeric'

const flowFields = [
  'contributionsCents',
  'requestedWithdrawalsCents',
  'withdrawalsCents',
  'shortfallCents',
  'growthCents',
  'realGrowthCents',
  'fundFeesCents',
  'advisoryFeesCents',
] as const

function summarize(
  rows: readonly MonthlyRow[],
  opening: number,
): LedgerAmounts {
  const summary: LedgerAmounts = {
    openingBalanceCents: opening,
    contributionsCents: 0,
    requestedWithdrawalsCents: 0,
    withdrawalsCents: 0,
    shortfallCents: 0,
    growthCents: 0,
    realGrowthCents: 0,
    fundFeesCents: 0,
    advisoryFeesCents: 0,
    closingBalanceCents: opening,
    realClosingBalanceCents: opening,
  }
  for (const row of rows) {
    for (const field of flowFields)
      summary[field] = cents(summary[field] + row[field])
    summary.closingBalanceCents = row.closingBalanceCents
    summary.realClosingBalanceCents = row.realClosingBalanceCents
  }
  return summary
}

export function runGrowthProjection(input: unknown): ProjectionOutcome {
  const errors: ValidationIssue[] = []
  if (!validateGrowthInput(input, errors)) return { ok: false, errors }

  const assumptions = { ...input }
  const monthly: MonthlyRow[] = []
  const annual: AnnualRow[] = []
  const monthlyReturn = effectiveMonthlyRate(input.annualReturnRate)
  let balance = input.startingBalanceCents
  let firstShortfallMonth: number | null = null
  try {
    for (let month = 1; month <= input.months; month++) {
      const opening = balance
      let withdrawn = 0
      const applyCashFlows = () => {
        balance = cents(balance + input.monthlyContributionCents)
        withdrawn = Math.min(balance, input.monthlyWithdrawalCents)
        balance -= withdrawn
      }

      if (input.cashFlowTiming === 'beginning') applyCashFlows()
      const growth = cents(balance * monthlyReturn)
      balance = cents(balance + growth)
      const fundFee =
        input.returnBasis === 'before-fund-expenses'
          ? cents(balance * (input.annualFundExpenseRatio / 12))
          : 0
      const advisoryFee = cents(balance * (input.annualAdvisoryFeeRate / 12))
      balance = cents(balance - fundFee - advisoryFee)
      if (input.cashFlowTiming === 'end') applyCashFlows()

      const shortfall = input.monthlyWithdrawalCents - withdrawn
      if (shortfall > 0 && firstShortfallMonth === null)
        firstShortfallMonth = month
      const discount = inflationFactor(input.annualInflationRate, month)
      monthly.push({
        month,
        openingBalanceCents: opening,
        contributionsCents: input.monthlyContributionCents,
        requestedWithdrawalsCents: input.monthlyWithdrawalCents,
        withdrawalsCents: withdrawn,
        shortfallCents: shortfall,
        growthCents: growth,
        realGrowthCents: cents(growth / discount),
        fundFeesCents: fundFee,
        advisoryFeesCents: advisoryFee,
        closingBalanceCents: balance,
        realClosingBalanceCents: cents(balance / discount),
      })
    }
    for (let offset = 0; offset < monthly.length; offset += 12) {
      const rows = monthly.slice(offset, offset + 12)
      const first = rows[0]
      const last = rows.at(-1)
      if (!first || !last)
        throw new Error('An annual group must contain at least one month.')
      annual.push({
        year: offset / 12 + 1,
        startMonth: first.month,
        endMonth: last.month,
        ...summarize(rows, first.openingBalanceCents),
      })
    }
    return {
      ok: true,
      projection: {
        engineVersion: 'growth-1.1.0',
        assumptions,
        monthly,
        annual,
        totals: summarize(monthly, input.startingBalanceCents),
        firstShortfallMonth,
      },
    }
  } catch (error) {
    if (!(error instanceof NumericRangeError)) throw error
    return {
      ok: false,
      errors: [
        {
          field: 'calculation',
          message:
            'The projection exceeds the supported numeric range. Reduce amounts, rates, or duration.',
        },
      ],
    }
  }
}
