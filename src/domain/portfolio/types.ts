export interface PortfolioIssue {
  path: string
  message: string
}

export interface PortfolioAssetInput {
  id: string
  name: string
  type: 'stock' | 'bond'
  marketValueCents: number
  costBasisCents: number
  targetWeight: number
  annualPriceGrowthRate: number
  annualDistributionYield: number
  qualifiedDividendShare: number
}

export interface PortfolioAccountInput {
  id: string
  name: string
  startingCashCents: number
  monthlyContributionCents: number
  distributionMode: 'reinvest' | 'retain'
  rebalance: 'none' | 'annual' | 'threshold'
  driftThreshold: number
  assets: readonly PortfolioAssetInput[]
}

export interface PortfolioInput {
  startMonth: string
  months: number
  ordinaryTaxRate: number
  qualifiedDividendTaxRate: number
  realizedGainTaxRate: number
  accounts: readonly PortfolioAccountInput[]
}

export interface PortfolioAmounts {
  openingAssetsCents: number
  openingCashCents: number
  openingTaxLiabilityCents: number
  openingBasisCents: number
  growthCents: number
  contributionsCents: number
  qualifiedDividendsCents: number
  ordinaryDividendsCents: number
  interestCents: number
  salesCents: number
  purchasesCents: number
  realizedGainsCents: number
  distributionTaxCents: number
  capitalGainTaxCents: number
  taxAssessedCents: number
  taxPaidCents: number
  endingAssetsCents: number
  endingCashCents: number
  endingBasisCents: number
  grossAssetsCents: number
  taxLiabilityCents: number
  equityCents: number
  rebalanceCount: number
}

export interface PortfolioAssetMonth {
  assetId: string
  openingValueCents: number
  openingBasisCents: number
  growthCents: number
  qualifiedDividendsCents: number
  ordinaryDividendsCents: number
  interestCents: number
  salesCents: number
  basisSoldCents: number
  realizedGainsCents: number
  purchasesCents: number
  endingValueCents: number
  endingBasisCents: number
}

export interface PortfolioMonth extends PortfolioAmounts {
  month: number
  calendarMonth: string
}

export interface PortfolioAccountMonth extends PortfolioMonth {
  assets: readonly PortfolioAssetMonth[]
  netRealizationsYtdCents: number
  settlement: 'none' | 'year-end' | 'partial-year'
}

export interface PortfolioYear extends PortfolioAmounts {
  year: number
  startMonth: string
  endMonth: string
  partial: boolean
}

export interface PortfolioEvent {
  accountId: string
  calendarMonth: string
  type: 'rebalance' | 'year-end' | 'partial-year' | 'tax-shortage'
  amountCents: number
}

export interface PortfolioAccountResult {
  accountId: string
  monthly: readonly PortfolioAccountMonth[]
  annual: readonly PortfolioYear[]
  totals: PortfolioAmounts
}

export interface PortfolioProjection {
  engineVersion: 'portfolio-1.0.0'
  assumptions: PortfolioInput
  accounts: readonly PortfolioAccountResult[]
  monthly: readonly PortfolioMonth[]
  annual: readonly PortfolioYear[]
  totals: PortfolioAmounts
  events: readonly PortfolioEvent[]
}

export type PortfolioOutcome =
  | { ok: true; projection: PortfolioProjection }
  | { ok: false; errors: readonly PortfolioIssue[] }
