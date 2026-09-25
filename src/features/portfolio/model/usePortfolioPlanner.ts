import { useState } from 'react'
import type { PortfolioOutcome } from '../../../domain/portfolio'
import {
  createPortfolioDraft,
  evaluatePortfolio,
  newAccount,
  newAsset,
  preparePortfolioReport,
  portfolioChartMetricOptions,
  duplicateAccount,
  duplicateAsset,
  uniqueId,
} from './worksheet'
import type {
  AccountDraft,
  AssetDraft,
  PortfolioDraft,
  PortfolioChartMetric,
  PortfolioChartView,
} from './worksheet'
import { accountHelp, assetHelp, projectionHelp, metricHelp } from './help'

interface FieldView {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  help?: string
  text?: boolean
  options?: readonly { value: string; label: string }[]
}
const assetFields: readonly [Exclude<keyof AssetDraft, 'id'>, string][] = [
  ['name', 'Asset name'],
  ['marketValueCents', 'Initial market value (USD)'],
  ['costBasisCents', 'Initial pooled cost basis (USD)'],
  ['targetWeight', 'Target allocation (%)'],
  ['annualPriceGrowthRate', 'Annual price growth (%)'],
  ['annualDistributionYield', 'Annual distribution yield (%)'],
  ['qualifiedDividendShare', 'Qualified share of stock dividends (%)'],
]
const accountFields: readonly [
  Exclude<keyof AccountDraft, 'id' | 'assets'>,
  string,
][] = [
  ['name', 'Account name'],
  ['startingCashCents', 'Starting cash (USD)'],
  ['monthlyContributionCents', 'Monthly external cash contribution (USD)'],
  ['driftThreshold', 'Drift threshold (percentage points)'],
]

export function usePortfolioPlanner() {
  const [draft, setDraft] = useState(createPortfolioDraft)
  const [outcome, setOutcome] = useState<PortfolioOutcome>()
  const [selectedAccount, setSelectedAccount] = useState('total')
  const [selectedYear, setSelectedYear] = useState('')
  const [chartView, setChartView] = useState<PortfolioChartView>('accounts')
  const [chartMetric, setChartMetric] =
    useState<PortfolioChartMetric>('equityCents')
  function update(next: PortfolioDraft) {
    setDraft(next)
    setOutcome(undefined)
  }
  const errors = outcome && !outcome.ok ? outcome.errors : []
  const error = (path: string) =>
    errors.find((item) => item.path === path)?.message ?? ''
  function root(
    key: Exclude<keyof PortfolioDraft, 'accounts'>,
    label: string,
    text = false,
  ): FieldView {
    return {
      key,
      label,
      help: projectionHelp[key],
      value: draft[key],
      text,
      error: error(key),
      onChange: (value) => update({ ...draft, [key]: value }),
    }
  }
  function changeAccount(id: string, key: keyof AccountDraft, value: string) {
    update({
      ...draft,
      accounts: draft.accounts.map((account) =>
        account.id === id ? { ...account, [key]: value } : account,
      ),
    })
  }
  function changeAsset(
    accountId: string,
    id: string,
    key: keyof AssetDraft,
    value: string,
  ) {
    update({
      ...draft,
      accounts: draft.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              assets: account.assets.map((asset) =>
                asset.id === id
                  ? {
                      ...asset,
                      [key]: value,
                      ...(key === 'type' && value === 'bond'
                        ? { qualifiedDividendShare: '0' }
                        : {}),
                    }
                  : asset,
              ),
            }
          : account,
      ),
    })
  }
  const fields = [
    root('startMonth', 'Start month (YYYY-MM)', true),
    root('years', 'Projection whole years'),
    root('additionalMonths', 'Additional months (0–11)'),
    root('ordinaryTaxRate', 'Ordinary income tax rate (%)'),
    root('qualifiedDividendTaxRate', 'Qualified dividend tax rate (%)'),
    root('realizedGainTaxRate', 'Realized gain tax rate (%)'),
  ]
  const accounts = draft.accounts.map((account, index) => {
    const path = `accounts[${index}]`
    const fields: FieldView[] = accountFields.map(([key, label]) => ({
      key,
      label,
      help: accountHelp[key],
      value: String(account[key]),
      text: key === 'name',
      error: error(`${path}.${key}`),
      onChange: (value) => changeAccount(account.id, key, value),
    }))
    fields.push(
      {
        key: 'newCashMode',
        label: 'Invest new cash',
        value: account.newCashMode,
        help: accountHelp.newCashMode,
        hint: 'Starting cash and new deposits; dividend handling is separate.',
        error: error(`${path}.newCashMode`),
        options: [
          { value: 'invest', label: 'Invest monthly by target allocation' },
          { value: 'hold', label: 'Hold until a rebalance' },
        ],
        onChange: (value) => changeAccount(account.id, 'newCashMode', value),
      },
      {
        key: 'distributionMode',
        label: 'Distribution handling between rebalances',
        value: account.distributionMode,
        help: accountHelp.distributionMode,
        options: [
          { value: 'reinvest', label: 'Reinvest after-tax distributions' },
          {
            value: 'retain',
            label: 'Hold distributions until next rebalance',
          },
        ],
        onChange: (value) =>
          changeAccount(account.id, 'distributionMode', value),
      },
      {
        key: 'rebalance',
        label: 'Rebalance policy',
        value: account.rebalance,
        help: accountHelp.rebalance,
        hint: 'Threshold checks monthly; it does not automatically trade monthly.',
        options: [
          { value: 'none', label: 'None' },
          { value: 'annual', label: 'Calendar annual — December' },
          { value: 'threshold', label: 'Threshold — checked monthly' },
        ],
        onChange: (value) => changeAccount(account.id, 'rebalance', value),
      },
    )
    return {
      id: account.id,
      title: account.name || 'Unnamed account',
      fields,
      allocationError: error(`${path}.assets`),
      duplicate: () => update(duplicateAccount(draft, account.id)),
      remove: () =>
        update({
          ...draft,
          accounts: draft.accounts.filter((item) => item.id !== account.id),
        }),
      addAsset: () =>
        update({
          ...draft,
          accounts: draft.accounts.map((item) =>
            item.id === account.id
              ? {
                  ...item,
                  assets: [
                    ...item.assets,
                    newAsset(
                      uniqueId(
                        'asset',
                        item.assets.map((asset) => asset.id),
                      ),
                    ),
                  ],
                }
              : item,
          ),
        }),
      assets: account.assets.map((asset, assetIndex) => {
        const assetPath = `${path}.assets[${assetIndex}]`
        const fields: FieldView[] = assetFields.map(([key, label]) => ({
          key,
          label,
          help: assetHelp[key],
          value: asset[key],
          text: key === 'name',
          error: error(`${assetPath}.${key}`),
          onChange: (value) => changeAsset(account.id, asset.id, key, value),
        }))
        fields.push({
          key: 'type',
          label: 'Asset type',
          value: asset.type,
          help: assetHelp.type,
          options: [
            { value: 'stock', label: 'Stock — dividends' },
            { value: 'bond', label: 'Bond — ordinary interest' },
          ],
          onChange: (value) => changeAsset(account.id, asset.id, 'type', value),
        })
        return {
          id: asset.id,
          title: asset.name || 'Unnamed asset',
          fields,
          duplicate: () => update(duplicateAsset(draft, account.id, asset.id)),
          remove: () =>
            update({
              ...draft,
              accounts: draft.accounts.map((item) =>
                item.id === account.id
                  ? {
                      ...item,
                      assets: item.assets.filter((a) => a.id !== asset.id),
                    }
                  : item,
              ),
            }),
        }
      }),
    }
  })
  return {
    fields,
    accounts,
    chartFields: [
      {
        key: 'chartView',
        label: 'Chart view',
        value: chartView,
        help: 'By account shows a separate line for each account, using its name in the legend. Combined shows the sum of all accounts. This changes only the chart; detailed-table selections are separate. Accounts are still treated as additive holdings, not saved alternative plans.',
        options: [
          { value: 'accounts', label: 'Each account separately' },
          { value: 'total', label: 'All holdings combined' },
        ],
        onChange: (value: string) => {
          if (value !== 'accounts' && value !== 'total')
            throw new Error(`Unsupported chart view: ${value}`)
          setChartView(value)
        },
      },
      {
        key: 'chartMetric',
        label: 'Chart measure',
        value: chartMetric,
        help: metricHelp[chartMetric],
        options: portfolioChartMetricOptions,
        onChange: (value: string) => {
          const option = portfolioChartMetricOptions.find(
            (item) => item.value === value,
          )
          if (!option) throw new Error(`Unsupported chart measure: ${value}`)
          setChartMetric(option.value)
        },
      },
    ],
    addAccount: () =>
      update({
        ...draft,
        accounts: [
          ...draft.accounts,
          newAccount(
            uniqueId(
              'account',
              draft.accounts.map((account) => account.id),
            ),
          ),
        ],
      }),
    calculate: () => setOutcome(evaluatePortfolio(draft)),
    errors: errors.map((item) => `${item.path}: ${item.message}`),
    status: !outcome
      ? 'Edit inputs, then calculate. Edits clear previous results.'
      : outcome.ok
        ? `Calculated with ${outcome.projection.engineVersion}. All values are nominal USD.`
        : 'Correct the listed inputs before calculating.',
    report: outcome?.ok
      ? preparePortfolioReport(
          outcome.projection,
          selectedAccount,
          selectedYear,
          chartView,
          chartMetric,
        )
      : undefined,
    selectedAccount,
    selectAccount: setSelectedAccount,
    selectYear: setSelectedYear,
  }
}

export type PortfolioPlannerModel = ReturnType<typeof usePortfolioPlanner>
export type { FieldView }
