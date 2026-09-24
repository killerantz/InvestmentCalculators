import { useState } from 'react'
import type { PortfolioOutcome } from '../../../domain/portfolio'
import {
  createPortfolioDraft,
  evaluatePortfolio,
  newAccount,
  newAsset,
  preparePortfolioReport,
} from './worksheet'
import type { AccountDraft, AssetDraft, PortfolioDraft } from './worksheet'

interface FieldView {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  text?: boolean
  options?: readonly { value: string; label: string }[]
}
const assetFields: readonly [keyof AssetDraft, string][] = [
  ['name', 'Asset name'],
  ['marketValueCents', 'Initial market value (USD)'],
  ['costBasisCents', 'Initial pooled cost basis (USD)'],
  ['targetWeight', 'Target allocation (%)'],
  ['annualPriceGrowthRate', 'Annual price growth (%)'],
  ['annualDistributionYield', 'Annual distribution yield (%)'],
  ['qualifiedDividendShare', 'Qualified share of stock dividends (%)'],
]
const accountFields: readonly [keyof AccountDraft, string][] = [
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
  function uniqueId(prefix: string, ids: string[]) {
    let index = 1
    while (ids.includes(`${prefix}-${index}`)) index++
    return `${prefix}-${index}`
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
      value: String(account[key]),
      text: key === 'name',
      error: error(`${path}.${key}`),
      onChange: (value) => changeAccount(account.id, key, value),
    }))
    fields.push(
      {
        key: 'distributionMode',
        label: 'Distribution handling between rebalances',
        value: account.distributionMode,
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
          value: asset[key],
          text: key === 'name',
          error: error(`${assetPath}.${key}`),
          onChange: (value) => changeAsset(account.id, asset.id, key, value),
        }))
        fields.push({
          key: 'type',
          label: 'Asset type',
          value: asset.type,
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
        ? 'Calculated with portfolio-1.0.0. All values are nominal USD.'
        : 'Correct the listed inputs before calculating.',
    report: outcome?.ok
      ? preparePortfolioReport(
          outcome.projection,
          selectedAccount,
          selectedYear,
        )
      : undefined,
    selectedAccount,
    selectAccount: setSelectedAccount,
    selectYear: setSelectedYear,
  }
}

export type PortfolioPlannerModel = ReturnType<typeof usePortfolioPlanner>
export type { FieldView }
