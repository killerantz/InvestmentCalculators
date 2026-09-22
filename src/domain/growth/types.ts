export interface GrowthInput {
  startingBalanceCents: number
  monthlyContributionCents: number
  monthlyWithdrawalCents: number
  months: number
  annualReturnRate: number
  annualInflationRate: number
  annualFundExpenseRatio: number
  annualAdvisoryFeeRate: number
  returnBasis: 'before-fund-expenses' | 'after-fund-expenses'
  cashFlowTiming: 'beginning' | 'end'
}

export interface ValidationIssue {
  field: keyof GrowthInput | 'input' | 'calculation'
  message: string
}

export interface LedgerAmounts {
  openingBalanceCents: number
  contributionsCents: number
  requestedWithdrawalsCents: number
  withdrawalsCents: number
  shortfallCents: number
  growthCents: number
  realGrowthCents: number
  fundFeesCents: number
  advisoryFeesCents: number
  closingBalanceCents: number
  realClosingBalanceCents: number
}

export interface MonthlyRow extends LedgerAmounts {
  month: number
}

export interface AnnualRow extends LedgerAmounts {
  year: number
  startMonth: number
  endMonth: number
}

export interface GrowthProjection {
  engineVersion: 'growth-1.1.0'
  assumptions: Readonly<GrowthInput>
  monthly: readonly MonthlyRow[]
  annual: readonly AnnualRow[]
  totals: LedgerAmounts
  firstShortfallMonth: number | null
}

export type ProjectionOutcome =
  | { ok: true; projection: GrowthProjection }
  | { ok: false; errors: readonly ValidationIssue[] }
