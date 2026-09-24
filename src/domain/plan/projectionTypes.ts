import type { CompiledPlan, PersonId, PlanInput, PlanIssue } from './types'

export type IncomeStream = {
  id: string
  label: string
  kind: 'social-security' | 'pension'
  person: PersonId
  startAgeMonths: number
  /** Nominal monthly amount at the original first payment, not today's dollars. */
  monthlyAmountCents: number
  /** Applied on this stream's start anniversaries, including before the plan. */
  annualIncreaseRate: number
}

export type PhaseCashFlowChange = {
  phaseId: string
  monthlySpendingCents?: number
  withdrawalOrder?: readonly string[]
}

export type AccountTransfer = {
  id: string
  /** First active phase, inclusive. */
  phaseId: string
  /** Omitted: only phaseId. Named: through that phase inclusive. Null: through plan end. */
  endPhaseId?: string | null
  kind: 'transfer' | 'roth-conversion'
  sourceAccountId: string
  destinationAccountId: string
} & (
  | { amountKind?: 'monthly-dollars'; monthlyAmountCents: number }
  | {
      amountKind: 'annual-percentage'
      /** Fraction of the source's prior calendar Dec 31 closing balance. */
      annualRate: number
    }
)

export type PlanProjectionInput = {
  schedule: PlanInput
  incomes: readonly IncomeStream[]
  /** Missing means none. Processed monthly in input order, without arrears. */
  transfers?: readonly AccountTransfer[]
  cashAccountId: string
  /** Fixed nominal spending; inflation only discounts reporting values. */
  monthlySpendingCents: number
  withdrawalOrder: readonly string[]
  phaseChanges: readonly PhaseCashFlowChange[]
  annualInflationRate: number
}

export type AccountAmounts = {
  openingBalanceCents: number
  /** External, already-budgeted savings; never deducted from household income. */
  externalContributionsCents: number
  scheduledWithdrawalsCents: number
  scheduledWithdrawalShortfallCents: number
  transfersInCents: number
  transfersOutCents: number
  /** Unfilled transfer requests, attributed only to their source account. */
  transferShortfallCents: number
  /** Subset of transfersInCents, not an additional inflow. */
  rothConversionsInCents: number
  /** Subset of transfersOutCents, not an additional outflow. */
  rothConversionsOutCents: number
  automaticWithdrawalsCents: number
  surplusDepositsCents: number
  growthCents: number
  feesCents: number
  closingBalanceCents: number
  realClosingBalanceCents: number
  realGrowthCents: number
}

export type PlanAmounts = AccountAmounts & {
  /** Only Social Security and pension streams, not account transfers. */
  incomeCents: number
  requestedSpendingCents: number
  spendingCents: number
  /** Unmet household spending, independent of scheduled-request shortfall. */
  shortfallCents: number
}

export type AccountMonthlyRow = AccountAmounts & { accountId: string }

export type AccountSummary = AccountAmounts & {
  accountId: string
  /**
   * First projection month ending at zero, even if the account began empty.
   * An account refilled before month end is not depleted for that month.
   * Annual summaries report the first such month within their own interval.
   */
  firstDepletionMonth: number | null
}

export type PlanIncomeRow = { incomeId: string; amountCents: number }

export type PlanTransferRow = {
  transferId: string
  requestedCents: number
  amountCents: number
  shortfallCents: number
  /** Present only for active percentage transfers; frozen for the calendar year. */
  referenceBalanceCents?: number
  /** Rounded full-year target, not the sum of a partial phase's installments. */
  annualRequestedCents?: number
}

export type PlanMonthlyRow = PlanAmounts & {
  month: number
  calendarMonth: string
  phaseId: string
  accounts: AccountMonthlyRow[]
  /** All configured streams, with zero before their first payment. */
  incomes: PlanIncomeRow[]
  /** All configured transfers in input order, with zero amounts when inactive. */
  transfers: PlanTransferRow[]
}

export type PlanAnnualRow = PlanAmounts & {
  year: number
  startMonth: number
  endMonth: number
  accounts: AccountSummary[]
}

export type PlanProjection = {
  engineVersion: 'plan-projection-1.3.0'
  schedule: CompiledPlan
  monthly: PlanMonthlyRow[]
  /** Projection years, not calendar years; the last year may be partial. */
  annual: PlanAnnualRow[]
  /** First opening, last closing, summed flows; real values sum account cents. */
  totals: PlanAmounts
  accounts: AccountSummary[]
  /** First unmet-spending month, not a scheduled-withdrawal shortfall. */
  firstShortfallMonth: number | null
}

export type PlanProjectionOutcome =
  | { ok: true; projection: PlanProjection }
  | { ok: false; errors: readonly PlanIssue[] }
