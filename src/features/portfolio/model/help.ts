import type { PortfolioAmounts } from '../../../domain/portfolio'
import type { AccountDraft, AssetDraft, PortfolioDraft } from './worksheet'

export const projectionHelp: Record<
  Exclude<keyof PortfolioDraft, 'accounts'>,
  string
> = {
  startMonth:
    'The first month to model, such as 2026-01 for January 2026. Annual rebalancing happens in December, not on the anniversary of this date.',
  years:
    'How many full years to project. Add extra months in the next field. For six months, enter 0 years and 6 additional months. The maximum is 100 years total.',
  additionalMonths:
    'Months beyond the full years, from 0 to 11. For two and a half years, enter 2 years and 6 additional months.',
  ordinaryTaxRate:
    'Your estimated tax percentage on bond interest and the ordinary portion of stock dividends. At 20%, $100 of this income creates $20 of estimated tax. This is not your annual income or a tax-bracket calculation.',
  qualifiedDividendTaxRate:
    'Your estimated tax percentage on the qualified portion of stock dividends. Qualified dividends may receive a different tax rate. The calculator does not determine whether your dividends qualify.',
  realizedGainTaxRate:
    'Your estimated tax percentage on positive net profits from sales in each account and calendar year. Buying or holding a stock does not itself create a realized gain. Unrealized gains are not taxed here; short- and long-term gains use the same entered rate.',
}

export const accountHelp: Record<
  Exclude<keyof AccountDraft, 'id' | 'assets'>,
  string
> = {
  name: 'A nickname for this account. Accounts are added together as holdings, not compared as alternative versions of the same money.',
  startingCashCents:
    'Uninvested dollars already in the account at the start. Do not include dollars entered as an asset’s initial market value. The invest-new-cash choice controls when this cash buys investments. Cash earns no interest.',
  monthlyContributionCents:
    'New dollars added from outside the account each month, such as $100 from your paycheck. This is not a dividend or a transfer between these accounts. Taxes are paid before the remaining cash is invested.',
  newCashMode:
    'Invest monthly splits starting cash and each month’s new contribution by target allocation, after taxes. For 60%/40% targets, $100 buys $60/$40. Purchases happen at month-end, so first-month starting cash does not earn that month’s growth or dividends. This buys without selling existing holdings or counting as a rebalance. Hold until rebalance preserves the previous behavior; with no rebalance, that cash stays uninvested. Dividend handling is separate.',
  distributionMode:
    'Distributions are cash paid by investments: stock dividends or bond interest. Reinvest buys more of the same asset each month using its after-tax payout. Hold keeps those payouts as cash until a rebalance. This does not control starting cash or paycheck contributions.',
  rebalance:
    'Rebalancing adjusts existing investments toward your target percentages. December runs once each calendar year. Threshold checks monthly but trades only when an investment is far enough from its target. Cash is excluded from that check: one asset at a 100% target never drifts. At a rebalance, all remaining cash is invested, including held dividends. None disables rebalancing, not separately enabled new-cash purchases or dividend reinvestment.',
  driftThreshold:
    'Used only with threshold rebalancing. Enter percentage points, not a relative percentage: a 60% target with a 5-point threshold triggers at 55% or 65%. Cash is excluded. Enter more than 0 and at most 100.',
}

export const assetHelp: Record<Exclude<keyof AssetDraft, 'id'>, string> = {
  name: 'A nickname for an investment or grouped holding, such as US stock fund. No ticker lookup or live market data is used.',
  type: 'Stock payouts are modeled as dividends, split into qualified and ordinary portions. Bond payouts are modeled as ordinary taxable interest. This does not model tax-exempt bonds.',
  marketValueCents:
    'What this investment is worth at the start, not what you originally paid. For 10 shares worth $100 each, enter 1000. Enter 0 if new cash will buy it later.',
  costBasisCents:
    'The total tax cost of the shares you already own, usually what you paid with applicable adjustments. If shares cost $800 and are now worth $1,000, enter 800 here and 1000 as market value. Sales use a proportional share of this pooled cost to estimate profit; individual tax lots are not modeled.',
  targetWeight:
    'The desired percentage of invested holdings in this account, excluding cash. All asset targets must total 100%. New-cash purchases follow these percentages; rebalancing uses them to adjust existing holdings. This is not the dividend yield or share of dividends that qualify for a tax rate.',
  annualPriceGrowthRate:
    'Expected yearly change in the investment’s price, excluding dividends and interest. Enter 6 for 6%, not 0.06. Do not enter total return, because the separate yield would then be counted twice. The model converts this to a compounded monthly rate.',
  annualDistributionYield:
    'Expected yearly cash payout as a percentage of market value, separate from price growth. At 3%, $1,000 of unchanged value pays about $30 per year before tax. The model pays one-twelfth of the annual yield each month using value after that month’s price growth.',
  qualifiedDividendShare:
    'The percentage of stock dividends taxed at your qualified-dividend rate, not a tax rate itself. At 50%, a $10 dividend is split into $5 qualified and $5 ordinary. Bonds require 0 because their payouts are ordinary interest.',
}

export const metricHelp = {
  grossAssetsCents:
    'Investments plus remaining cash at the end. Cash already spent paying taxes is gone from this amount. This is not a before-tax growth scenario.',
  equityCents:
    'Gross assets minus unpaid assessed taxes. If all tax bills were paid, this equals gross assets. It does not deduct potential taxes from selling investments with unrealized gains.',
  endingAssetsCents:
    'The ending market value of stocks and bonds only. Cash is shown separately.',
  endingCashCents:
    'Uninvested dollars remaining at the end. Cash earns no interest. Check the new-cash, dividend, and rebalancing settings if this is larger than expected.',
  endingBasisCents:
    'The remaining pooled tax cost of investments. Purchases add to it; sales remove a proportional part. It is not the current market value.',
  growthCents:
    'Total modeled changes in investment prices during the projection. Excludes dividends, interest, contributions, and taxes.',
  contributionsCents:
    'Total new monthly deposits from outside the account. Starting cash and initial investments are not counted again here.',
  qualifiedDividendsCents:
    'Total stock payouts assigned to your qualified-dividend tax rate, before tax.',
  ordinaryDividendsCents:
    'Total stock payouts assigned to your ordinary-income tax rate, before tax.',
  interestCents:
    'Total bond payouts before ordinary-income tax. Account cash does not earn interest.',
  realizedGainsCents:
    'Sale proceeds minus the pooled cost assigned to the shares sold, summed across the projection. Tax is settled per account and calendar year, so this total is not necessarily the amount taxed.',
  salesCents:
    'Total cash received from selling investments. This includes the original cost as well as any gain or loss. It is not a return or an extra expense.',
  purchasesCents:
    'Total dollars used to buy investments, including new-cash purchases and reinvested payouts. This is not just money contributed from outside.',
  distributionTaxCents:
    'Estimated taxes charged on dividends and bond interest over the projection.',
  capitalGainTaxCents:
    'Estimated taxes charged on positive net sale profits in each account and calendar year. Also settles the final partial year.',
  taxAssessedCents:
    'Total estimated tax bills created by projected distributions and realized gains, whether paid yet or not.',
  taxPaidCents:
    'Total cash actually used to pay estimated tax bills. These payments already reduce gross assets.',
  taxLiabilityCents:
    'Estimated tax bills still unpaid at the end because cash was insufficient. Future cash pays these before purchases; the model does not sell extra investments just to cover them.',
  rebalanceCount:
    'Number of rebalance events. Monthly threshold checks are not events unless triggered. Investing new cash or reinvesting dividends alone does not count.',
} satisfies Partial<Record<keyof PortfolioAmounts, string>>
