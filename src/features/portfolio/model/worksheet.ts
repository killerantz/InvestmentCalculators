import { runPortfolioProjection } from '../../../domain/portfolio'
import type {
  PortfolioAmounts,
  PortfolioIssue,
  PortfolioOutcome,
  PortfolioProjection,
} from '../../../domain/portfolio'
import {
  formatMoney,
  parseMoney,
  parsePercentage,
} from '../../../shared/numbers'
import type { ComparisonChartProps, DataTableProps } from '@ui'

export interface AssetDraft {
  id: string
  name: string
  type: string
  marketValueCents: string
  costBasisCents: string
  targetWeight: string
  annualPriceGrowthRate: string
  annualDistributionYield: string
  qualifiedDividendShare: string
}
export interface AccountDraft {
  id: string
  name: string
  startingCashCents: string
  monthlyContributionCents: string
  distributionMode: string
  rebalance: string
  driftThreshold: string
  assets: AssetDraft[]
}
export interface PortfolioDraft {
  startMonth: string
  years: string
  additionalMonths: string
  ordinaryTaxRate: string
  qualifiedDividendTaxRate: string
  realizedGainTaxRate: string
  accounts: AccountDraft[]
}

export function newAsset(id: string): AssetDraft {
  return {
    id,
    name: 'Synthetic stock',
    type: 'stock',
    marketValueCents: '0',
    costBasisCents: '0',
    targetWeight: '0',
    annualPriceGrowthRate: '0',
    annualDistributionYield: '0',
    qualifiedDividendShare: '0',
  }
}
export function newAccount(id: string): AccountDraft {
  return {
    id,
    name: `Brokerage ${id}`,
    startingCashCents: '0',
    monthlyContributionCents: '0',
    distributionMode: 'reinvest',
    rebalance: 'none',
    driftThreshold: '5',
    assets: [
      {
        ...newAsset('asset-1'),
        marketValueCents: '1000',
        costBasisCents: '1000',
        targetWeight: '100',
        annualDistributionYield: '12',
        qualifiedDividendShare: '50',
      },
    ],
  }
}
export function createPortfolioDraft(): PortfolioDraft {
  return {
    startMonth: '2026-01',
    years: '1',
    additionalMonths: '0',
    ordinaryTaxRate: '20',
    qualifiedDividendTaxRate: '10',
    realizedGainTaxRate: '15',
    accounts: [newAccount('account-1')],
  }
}

export function evaluatePortfolio(draft: PortfolioDraft): PortfolioOutcome {
  const errors: PortfolioIssue[] = []
  function read(value: string, path: string, money = false) {
    const result = money ? parseMoney(value) : parsePercentage(value)
    if (!result.ok) {
      errors.push({ path, message: result.error })
      return undefined
    }
    return result.value
  }
  function integer(value: string, path: string, max: number) {
    if (!/^\d+$/.test(value.trim()) || Number(value) > max) {
      errors.push({ path, message: `Enter a whole number from 0 to ${max}.` })
      return 0
    }
    return Number(value)
  }
  const years = integer(draft.years, 'years', 100)
  const extra = integer(draft.additionalMonths, 'additionalMonths', 11)
  const input = {
    startMonth: draft.startMonth,
    months: years * 12 + extra,
    ordinaryTaxRate: read(draft.ordinaryTaxRate, 'ordinaryTaxRate'),
    qualifiedDividendTaxRate: read(
      draft.qualifiedDividendTaxRate,
      'qualifiedDividendTaxRate',
    ),
    realizedGainTaxRate: read(draft.realizedGainTaxRate, 'realizedGainTaxRate'),
    accounts: draft.accounts.map((account, index) => {
      const path = `accounts[${index}]`
      return {
        ...account,
        startingCashCents: read(
          account.startingCashCents,
          `${path}.startingCashCents`,
          true,
        ),
        monthlyContributionCents: read(
          account.monthlyContributionCents,
          `${path}.monthlyContributionCents`,
          true,
        ),
        driftThreshold: read(account.driftThreshold, `${path}.driftThreshold`),
        assets: account.assets.map((asset, assetIndex) => {
          const assetPath = `${path}.assets[${assetIndex}]`
          return {
            ...asset,
            marketValueCents: read(
              asset.marketValueCents,
              `${assetPath}.marketValueCents`,
              true,
            ),
            costBasisCents: read(
              asset.costBasisCents,
              `${assetPath}.costBasisCents`,
              true,
            ),
            targetWeight: read(asset.targetWeight, `${assetPath}.targetWeight`),
            annualPriceGrowthRate: read(
              asset.annualPriceGrowthRate,
              `${assetPath}.annualPriceGrowthRate`,
            ),
            annualDistributionYield: read(
              asset.annualDistributionYield,
              `${assetPath}.annualDistributionYield`,
            ),
            qualifiedDividendShare: read(
              asset.qualifiedDividendShare,
              `${assetPath}.qualifiedDividendShare`,
            ),
          }
        }),
      }
    }),
  }
  return errors.length ? { ok: false, errors } : runPortfolioProjection(input)
}

const metrics: readonly [keyof PortfolioAmounts, string][] = [
  ['grossAssetsCents', 'Ending gross assets'],
  ['equityCents', 'Ending equity after assessed taxes'],
  ['endingAssetsCents', 'Ending invested assets'],
  ['endingCashCents', 'Ending cash'],
  ['endingBasisCents', 'Ending pooled basis'],
  ['growthCents', 'Price growth'],
  ['contributionsCents', 'External contributions'],
  ['qualifiedDividendsCents', 'Qualified dividends'],
  ['ordinaryDividendsCents', 'Ordinary dividends'],
  ['interestCents', 'Bond interest'],
  ['realizedGainsCents', 'Net realized gains / losses'],
  ['salesCents', 'Sales turnover (proceeds)'],
  ['purchasesCents', 'Purchases'],
  ['distributionTaxCents', 'Distribution tax assessed'],
  ['capitalGainTaxCents', 'Gain tax assessed'],
  ['taxAssessedCents', 'Total tax assessed'],
  ['taxPaidCents', 'Total tax paid'],
  ['taxLiabilityCents', 'Ending unpaid tax liability'],
]

export function preparePortfolioReport(
  projection: PortfolioProjection,
  accountId: string,
  year: string,
) {
  const account = projection.accounts.find(
    (item) => item.accountId === accountId,
  )
  const name = (id: string) =>
    projection.assumptions.accounts.find((item) => item.id === id)!.name
  const accountOptions = [
    { value: 'total', label: 'All holdings — totals' },
    ...projection.accounts.map((item) => ({
      value: item.accountId,
      label: name(item.accountId),
    })),
  ]
  const yearOptions = projection.annual.map((item) => ({
    value: String(item.year),
    label: String(item.year),
  }))
  const selectedYear = yearOptions.some((item) => item.value === year)
    ? year
    : yearOptions[0]!.value
  const years = account?.annual ?? projection.annual
  const months = (account?.monthly ?? projection.monthly).filter(
    (row) => Number(row.calendarMonth.slice(0, 4)) === Number(selectedYear),
  )
  const summary: DataTableProps = {
    caption: 'All accounts are holdings, not alternative scenarios',
    columns: [
      'Measure',
      ...projection.accounts.map((item) => name(item.accountId)),
      'All holdings',
    ],
    rows: [
      ...metrics.map(([key, label]) => ({
        id: key,
        cells: [
          label,
          ...projection.accounts.map((item) => formatMoney(item.totals[key])),
          formatMoney(projection.totals[key]),
        ],
      })),
      {
        id: 'rebalances',
        cells: [
          'Rebalance events',
          ...projection.accounts.map((item) =>
            String(item.totals.rebalanceCount),
          ),
          String(projection.totals.rebalanceCount),
        ],
      },
    ],
  }
  const ledgerMetrics: readonly [keyof PortfolioAmounts, string][] = [
    ['growthCents', 'Price growth'],
    ['contributionsCents', 'Contributions'],
    ['qualifiedDividendsCents', 'Qualified dividends'],
    ['ordinaryDividendsCents', 'Ordinary dividends'],
    ['interestCents', 'Interest'],
    ['salesCents', 'Sales'],
    ['purchasesCents', 'Purchases'],
    ['realizedGainsCents', 'Net gains / losses'],
    ['distributionTaxCents', 'Distribution tax'],
    ['capitalGainTaxCents', 'Gain tax'],
    ['taxAssessedCents', 'Tax assessed'],
    ['taxPaidCents', 'Tax paid'],
    ['taxLiabilityCents', 'Unpaid tax'],
    ['endingBasisCents', 'Basis'],
    ['endingCashCents', 'Cash'],
    ['endingAssetsCents', 'Invested assets'],
    ['grossAssetsCents', 'Gross assets'],
    ['equityCents', 'Equity'],
  ]
  const ledgerColumns = ledgerMetrics.map(([, label]) => label)
  const cells = (row: PortfolioAmounts) =>
    ledgerMetrics.map(([key]) => formatMoney(row[key]))
  const annual: DataTableProps = {
    caption: 'Calendar-year ledger — no cross-account loss netting',
    columns: ['Period', ...ledgerColumns],
    rows: years.map((row) => ({
      id: String(row.year),
      cells: [
        `${row.startMonth} – ${row.endMonth}${row.partial ? ' (partial)' : ''}`,
        ...cells(row),
      ],
    })),
  }
  const monthly: DataTableProps = {
    caption: 'Monthly account / total ledger',
    columns: ['Month', ...ledgerColumns],
    rows: months.map((row) => ({
      id: row.calendarMonth,
      cells: [row.calendarMonth, ...cells(row)],
    })),
  }
  const assetColumns = [
    'Month',
    'Account',
    'Asset',
    'Opening value',
    'Growth',
    'Qualified dividends',
    'Ordinary dividends',
    'Interest',
    'Sales',
    'Basis sold',
    'Net gains / losses',
    'Purchases',
    'Ending value',
    'Ending basis',
  ]
  const assets: DataTableProps = {
    caption: 'Monthly pooled-basis asset ledger',
    columns: assetColumns,
    rows: projection.accounts
      .filter((item) => !account || item.accountId === account.accountId)
      .flatMap((item) =>
        item.monthly
          .filter(
            (row) =>
              Number(row.calendarMonth.slice(0, 4)) === Number(selectedYear),
          )
          .flatMap((row) =>
            row.assets.map((asset) => ({
              id: `${item.accountId}-${row.month}-${asset.assetId}`,
              cells: [
                row.calendarMonth,
                name(item.accountId),
                projection.assumptions.accounts
                  .find((a) => a.id === item.accountId)!
                  .assets.find((a) => a.id === asset.assetId)!.name,
                ...[
                  asset.openingValueCents,
                  asset.growthCents,
                  asset.qualifiedDividendsCents,
                  asset.ordinaryDividendsCents,
                  asset.interestCents,
                  asset.salesCents,
                  asset.basisSoldCents,
                  asset.realizedGainsCents,
                  asset.purchasesCents,
                  asset.endingValueCents,
                  asset.endingBasisCents,
                ].map(formatMoney),
              ],
            })),
          ),
      ),
  }
  const events: DataTableProps = {
    caption: 'Rebalance, settlement, and tax-shortage events',
    columns: ['Month', 'Account', 'Event', 'Sales / tax / outstanding amount'],
    rows: projection.events
      .filter(
        (event) =>
          (!account || event.accountId === account.accountId) &&
          Number(event.calendarMonth.slice(0, 4)) === Number(selectedYear),
      )
      .map((event, index) => ({
        id: String(index),
        cells: [
          event.calendarMonth,
          name(event.accountId),
          event.type === 'partial-year'
            ? 'Partial-year gain-tax settlement'
            : event.type,
          formatMoney(event.amountCents),
        ],
      })),
  }
  const opening =
    projection.totals.openingAssetsCents + projection.totals.openingCashCents
  const chart: ComparisonChartProps = {
    title: 'All holdings: gross assets and equity after assessed taxes',
    xLabel: 'Projection month',
    yLabel: 'Nominal USD',
    series: [
      {
        id: 'gross',
        label: 'Gross assets',
        points: [
          { x: 0, y: opening },
          ...projection.monthly.map((row) => ({
            x: row.month,
            y: row.grossAssetsCents,
          })),
        ],
      },
      {
        id: 'equity',
        label: 'Equity after assessed taxes',
        points: [
          { x: 0, y: opening },
          ...projection.monthly.map((row) => ({
            x: row.month,
            y: row.equityCents,
          })),
        ],
      },
    ],
    formatValue: (value) => formatMoney(Math.round(value)),
  }
  return {
    summary,
    annual,
    monthly,
    assets,
    events,
    chart,
    accountOptions,
    yearOptions,
    selectedYear,
    selectedAccount: account?.accountId ?? 'total',
  }
}
