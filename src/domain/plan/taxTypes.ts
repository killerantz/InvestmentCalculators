/** Estimated planning rates, not tax brackets or an eligibility determination. */
export type PlanTaxRates = {
  ordinaryRate: number
  capitalGainsRate: number
  qualifiedDividendRate: number
}

export type PlanTaxAccountAssumptions = {
  accountId: string
  costBasisCents: number
  /** Reinvested payouts already included in the account's total return, 0–1. */
  annualDividendYield: number
  qualifiedDividendShare: number
}

export type PlanTaxIncomeAssumptions = {
  incomeId: string
  /** User estimate: 0–1 for pensions, 0–0.85 for Social Security. */
  taxableShare: number
}

export type PlanTaxPhaseRates = Partial<PlanTaxRates> & {
  phaseId: string
  /** Omitted inherits; null resumes following the spending withdrawal order. */
  paymentOrder?: readonly string[] | null
}

export type PlanTaxAssumptions = PlanTaxRates & {
  /** Preferred tax funding accounts; omitted follows spending. Spending is the fallback. */
  paymentOrder?: readonly string[]
  /** Exactly one entry for each taxable brokerage account, and no others. */
  accounts: readonly PlanTaxAccountAssumptions[]
  /** Exactly one entry for every configured income stream. */
  incomes: readonly PlanTaxIncomeAssumptions[]
  /** Rates and payment-order overrides carry forward; explicit zero rates are retained. */
  phaseRates: readonly PlanTaxPhaseRates[]
}

export type PlanTaxAmounts = {
  /** Includes ordinary dividends, traditional distributions and taxable income. */
  ordinaryIncomeCents: number
  /** Signed realized gains for audit; losses never offset taxable positive sales. */
  capitalGainsCents: number
  qualifiedDividendsCents: number
  ordinaryDividendsCents: number
  ordinaryTaxCents: number
  capitalGainsTaxCents: number
  qualifiedDividendTaxCents: number
  taxAssessedCents: number
  taxPaidCents: number
  /** Closing liability snapshot, not a sum over the reporting interval. */
  unpaidTaxCents: number
}

export type PlanTaxAccountRow = {
  accountId: string
  openingBasisCents: number | null
  closingBasisCents: number | null
  realizedGainsCents: number
  ordinaryIncomeCents: number
  qualifiedDividendsCents: number
  ordinaryDividendsCents: number
  taxAssessedCents: number
}

export type PlanTaxMonthlyRow = PlanTaxAmounts & {
  month: number
  calendarMonth: string
  phaseId: string
  accounts: PlanTaxAccountRow[]
}

export type PlanTaxAnnualRow = PlanTaxAmounts & {
  year: number
  startMonth: number
  endMonth: number
}

export type PlanTaxProjection = {
  monthly: PlanTaxMonthlyRow[]
  /** Projection-year intervals, matching the main report (not calendar years). */
  annual: PlanTaxAnnualRow[]
  totals: PlanTaxAmounts
}
