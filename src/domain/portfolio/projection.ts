import { cents, effectiveMonthlyRate, NumericRangeError } from '../numeric'
import type {
  PortfolioAccountInput,
  PortfolioAccountMonth,
  PortfolioAmounts,
  PortfolioAssetMonth,
  PortfolioEvent,
  PortfolioInput,
  PortfolioIssue,
  PortfolioMonth,
  PortfolioOutcome,
  PortfolioYear,
} from './types'
import { validatePortfolioInput } from './validation'

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => cents(total + value), 0)

/** Input order breaks cent-rounding ties; allocations never exceed the budget. */
function allocate(budget: number, weights: readonly number[]): number[] {
  let remaining = budget
  let weightLeft = weights.reduce((total, weight) => total + weight, 0)
  return weights.map((weight) => {
    const amount =
      weightLeft > 0
        ? Math.min(
            remaining,
            Math.max(0, cents(remaining * (weight / weightLeft))),
          )
        : 0
    remaining -= amount
    weightLeft = Math.max(0, weightLeft - weight)
    return amount
  })
}

function saleBasis(basis: number, sale: number, value: number) {
  if (sale === value) return basis
  const numerator = BigInt(basis) * BigInt(sale)
  return Number((numerator * 2n + BigInt(value)) / (2n * BigInt(value)))
}

const openingKeys = [
  'openingAssetsCents',
  'openingCashCents',
  'openingTaxLiabilityCents',
  'openingBasisCents',
] as const
const closingKeys = [
  'endingAssetsCents',
  'endingCashCents',
  'endingBasisCents',
  'grossAssetsCents',
  'taxLiabilityCents',
  'equityCents',
] as const
const flowKeys = [
  'growthCents',
  'contributionsCents',
  'qualifiedDividendsCents',
  'ordinaryDividendsCents',
  'interestCents',
  'salesCents',
  'purchasesCents',
  'realizedGainsCents',
  'distributionTaxCents',
  'capitalGainTaxCents',
  'taxAssessedCents',
  'taxPaidCents',
  'rebalanceCount',
] as const

function combine(
  rows: readonly PortfolioAmounts[],
  acrossAccounts = false,
): PortfolioAmounts {
  const result = {} as PortfolioAmounts
  for (const key of openingKeys)
    result[key] = acrossAccounts
      ? sum(rows.map((row) => row[key]))
      : rows[0]![key]
  for (const key of closingKeys)
    result[key] = acrossAccounts
      ? sum(rows.map((row) => row[key]))
      : rows[rows.length - 1]![key]
  for (const key of flowKeys) result[key] = sum(rows.map((row) => row[key]))
  sum([result.openingAssetsCents, result.openingCashCents])
  return result
}

function annualRows(rows: readonly PortfolioMonth[]): PortfolioYear[] {
  const years = new Map<string, PortfolioMonth[]>()
  for (const row of rows) {
    const year = row.calendarMonth.slice(0, 4)
    const group = years.get(year) ?? []
    group.push(row)
    years.set(year, group)
  }
  return [...years].map(([year, group]) => ({
    ...combine(group),
    year: Number(year),
    startMonth: group[0]!.calendarMonth,
    endMonth: group[group.length - 1]!.calendarMonth,
    partial: group.length !== 12,
  }))
}

function runAccount(
  account: PortfolioAccountInput,
  input: PortfolioInput,
  events: PortfolioEvent[],
): PortfolioAccountMonth[] {
  const assets = account.assets.map((asset) => ({ ...asset }))
  let cash = account.startingCashCents
  let newCash = account.startingCashCents
  let liability = 0
  let netGainsYtd = 0
  const startYear = Number(input.startMonth.slice(0, 4))
  const startMonth = Number(input.startMonth.slice(5))
  const monthly: PortfolioAccountMonth[] = []
  for (let month = 1; month <= input.months; month++) {
    const calendarIndex = startYear * 12 + startMonth - 1 + month - 1
    const calendarMonth = `${Math.floor(calendarIndex / 12)
      .toString()
      .padStart(
        4,
        '0',
      )}-${((calendarIndex % 12) + 1).toString().padStart(2, '0')}`
    const december = calendarIndex % 12 === 11
    const settlement = december
      ? 'year-end'
      : month === input.months
        ? 'partial-year'
        : 'none'
    const openingCashCents = cash
    const openingTaxLiabilityCents = liability
    const openingAssetsCents = sum(
      assets.map((asset) => asset.marketValueCents),
    )
    sum([openingAssetsCents, openingCashCents])
    const openingBasisCents = sum(assets.map((asset) => asset.costBasisCents))
    let taxPaidCents = 0
    function payTax() {
      const paid = Math.min(cash, liability)
      cash -= paid
      // Pay from other cash first, then reduce cash earmarked for new purchases.
      newCash = Math.min(newCash, cash)
      liability -= paid
      taxPaidCents = cents(taxPaidCents + paid)
    }

    // Price growth; yield on post-growth value (no price decrement: price return
    // excludes distributions); external cash; distribution tax and old liability.
    const rows: PortfolioAssetMonth[] = assets.map((asset) => {
      const openingValueCents = asset.marketValueCents
      const openingBasis = asset.costBasisCents
      const growthCents = cents(
        openingValueCents * effectiveMonthlyRate(asset.annualPriceGrowthRate),
      )
      asset.marketValueCents = cents(openingValueCents + growthCents)
      const distribution = cents(
        asset.marketValueCents * (asset.annualDistributionYield / 12),
      )
      const qualifiedDividendsCents =
        asset.type === 'stock'
          ? cents(distribution * asset.qualifiedDividendShare)
          : 0
      return {
        assetId: asset.id,
        openingValueCents,
        openingBasisCents: openingBasis,
        growthCents,
        qualifiedDividendsCents,
        ordinaryDividendsCents:
          asset.type === 'stock' ? distribution - qualifiedDividendsCents : 0,
        interestCents: asset.type === 'bond' ? distribution : 0,
        salesCents: 0,
        basisSoldCents: 0,
        realizedGainsCents: 0,
        purchasesCents: 0,
        endingValueCents: 0,
        endingBasisCents: 0,
      }
    })
    const qualifiedDividendsCents = sum(
      rows.map((row) => row.qualifiedDividendsCents),
    )
    const ordinaryDividendsCents = sum(
      rows.map((row) => row.ordinaryDividendsCents),
    )
    const interestCents = sum(rows.map((row) => row.interestCents))
    const distributions = sum([
      qualifiedDividendsCents,
      ordinaryDividendsCents,
      interestCents,
    ])
    const distributionTaxes = rows.map((row) =>
      sum([
        cents(row.qualifiedDividendsCents * input.qualifiedDividendTaxRate),
        cents(row.ordinaryDividendsCents * input.ordinaryTaxRate),
        cents(row.interestCents * input.ordinaryTaxRate),
      ]),
    )
    const distributionTaxCents = sum(distributionTaxes)
    cash = sum([cash, account.monthlyContributionCents, distributions])
    newCash = cents(newCash + account.monthlyContributionCents)
    liability = sum([liability, distributionTaxCents])
    payTax()
    const invested = sum(assets.map((asset) => asset.marketValueCents))
    const rebalance =
      account.rebalance === 'annual'
        ? december
        : account.rebalance === 'threshold' &&
          invested > 0 &&
          assets.some(
            (asset) =>
              Math.abs(asset.marketValueCents / invested - asset.targetWeight) +
                1e-12 >=
              account.driftThreshold,
          )

    // Fix the sale plan from pretrade invested weights, excluding cash and taxes.
    // Only those sales occur: never liquidate extra assets to fund tax.
    if (rebalance) {
      const targets = allocate(
        invested,
        assets.map((asset) => asset.targetWeight),
      )
      assets.forEach((asset, index) => {
        const sale = Math.max(0, asset.marketValueCents - targets[index]!)
        if (!sale) return
        const basis = saleBasis(
          asset.costBasisCents,
          sale,
          asset.marketValueCents,
        )
        asset.marketValueCents -= sale
        asset.costBasisCents -= basis
        rows[index]!.salesCents = sale
        rows[index]!.basisSoldCents = basis
        rows[index]!.realizedGainsCents = sale - basis
        cash = cents(cash + sale)
        netGainsYtd = cents(netGainsYtd + (sale - basis))
      })
      events.push({
        accountId: account.id,
        calendarMonth,
        type: 'rebalance',
        amountCents: sum(rows.map((row) => row.salesCents)),
      })
    }
    // Settle this calendar year's net gains BEFORE any purchases this month.
    // There are no interim gains charges, cross-account offsets, or carryforwards.
    const capitalGainTaxCents =
      settlement === 'none'
        ? 0
        : cents(Math.max(0, netGainsYtd) * input.realizedGainTaxRate)
    liability = cents(liability + capitalGainTaxCents)
    payTax()
    if (settlement !== 'none')
      events.push({
        accountId: account.id,
        calendarMonth,
        type: settlement,
        amountCents: capitalGainTaxCents,
      })
    const ytd = netGainsYtd
    if (december) netGainsYtd = 0

    let purchases = assets.map(() => 0)
    if (rebalance) {
      // Taxes reduce the investable sleeve. Allocate only the cash remaining
      // after tax to deficits; overweight positions need not be sold again.
      const total = cents(
        sum(assets.map((asset) => asset.marketValueCents)) + cash,
      )
      const targets = allocate(
        total,
        assets.map((asset) => asset.targetWeight),
      )
      const deficits = assets.map((asset, index) =>
        Math.max(0, targets[index]! - asset.marketValueCents),
      )
      purchases = allocate(Math.min(cash, sum(deficits)), deficits)
      newCash = 0
    } else if (account.distributionMode === 'reinvest') {
      const netDistributions = rows.map(
        (row, index) =>
          sum([
            row.qualifiedDividendsCents,
            row.ordinaryDividendsCents,
            row.interestCents,
          ]) - distributionTaxes[index]!,
      )
      purchases = allocate(
        Math.min(
          account.newCashMode === 'invest' ? cash - newCash : cash,
          sum(netDistributions),
        ),
        netDistributions,
      )
    }
    if (!rebalance && account.newCashMode === 'invest') {
      const newPurchases = allocate(
        newCash,
        assets.map((asset) => asset.targetWeight),
      )
      purchases = purchases.map((amount, index) =>
        cents(amount + newPurchases[index]!),
      )
      newCash = 0
    }
    assets.forEach((asset, index) => {
      const purchase = purchases[index]!
      cash -= purchase
      asset.marketValueCents = cents(asset.marketValueCents + purchase)
      asset.costBasisCents = cents(asset.costBasisCents + purchase)
      rows[index]!.purchasesCents = purchase
      rows[index]!.endingValueCents = asset.marketValueCents
      rows[index]!.endingBasisCents = asset.costBasisCents
    })
    if (liability)
      events.push({
        accountId: account.id,
        calendarMonth,
        type: 'tax-shortage',
        amountCents: liability,
      })
    const endingAssetsCents = sum(assets.map((asset) => asset.marketValueCents))
    const grossAssetsCents = cents(endingAssetsCents + cash)
    monthly.push({
      month,
      calendarMonth,
      openingAssetsCents,
      openingCashCents,
      openingTaxLiabilityCents,
      openingBasisCents,
      growthCents: sum(rows.map((row) => row.growthCents)),
      contributionsCents: account.monthlyContributionCents,
      qualifiedDividendsCents,
      ordinaryDividendsCents,
      interestCents,
      salesCents: sum(rows.map((row) => row.salesCents)),
      purchasesCents: sum(rows.map((row) => row.purchasesCents)),
      realizedGainsCents: sum(rows.map((row) => row.realizedGainsCents)),
      distributionTaxCents,
      capitalGainTaxCents,
      taxAssessedCents: cents(distributionTaxCents + capitalGainTaxCents),
      taxPaidCents,
      endingAssetsCents,
      endingCashCents: cash,
      endingBasisCents: sum(assets.map((asset) => asset.costBasisCents)),
      grossAssetsCents,
      taxLiabilityCents: liability,
      equityCents: cents(grossAssetsCents - liability),
      rebalanceCount: rebalance ? 1 : 0,
      assets: rows,
      netRealizationsYtdCents: ytd,
      settlement,
    })
  }
  return monthly
}

export function runPortfolioProjection(raw: unknown): PortfolioOutcome {
  const errors: PortfolioIssue[] = []
  if (!validatePortfolioInput(raw, errors)) return { ok: false, errors }
  // Explicit snapshot: no caller-owned account or asset objects are retained.
  const input: PortfolioInput = {
    ...raw,
    accounts: raw.accounts.map((account) => ({
      ...account,
      assets: account.assets.map((asset) => ({ ...asset })),
    })),
  }
  try {
    const events: PortfolioEvent[] = []
    const accounts = input.accounts.map((account) => {
      const monthly = runAccount(account, input, events)
      return {
        accountId: account.id,
        monthly,
        annual: annualRows(monthly),
        totals: combine(monthly),
      }
    })
    const monthly = accounts[0]!.monthly.map((row, index) => ({
      month: row.month,
      calendarMonth: row.calendarMonth,
      ...combine(
        accounts.map((account) => account.monthly[index]!),
        true,
      ),
    }))
    return {
      ok: true,
      projection: {
        engineVersion: 'portfolio-1.1.0',
        assumptions: input,
        accounts,
        monthly,
        annual: annualRows(monthly),
        totals: combine(monthly),
        events,
      },
    }
  } catch (error) {
    if (!(error instanceof NumericRangeError)) throw error
    return {
      ok: false,
      errors: [
        {
          path: 'calculation',
          message:
            'The projection exceeds safe finite integer cents. Reduce balances, rates, or horizon.',
        },
      ],
    }
  }
}
