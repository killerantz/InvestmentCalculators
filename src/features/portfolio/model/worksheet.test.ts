import { describe, expect, it } from 'vitest'
import {
  createPortfolioDraft,
  evaluatePortfolio,
  newAccount,
  newAsset,
  preparePortfolioReport,
} from './worksheet'

describe('portfolio worksheet model', () => {
  it('parses the synthetic one-month fixture and formats exact cents for tables and chart', () => {
    const draft = createPortfolioDraft()
    draft.years = '0'
    draft.additionalMonths = '1'
    const outcome = evaluatePortfolio(draft)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.projection.totals.equityCents).toBe(100_850)
    const report = preparePortfolioReport(outcome.projection, 'total', '')
    expect(
      report.summary.rows.find((row) => row.id === 'equityCents')!.cells,
    ).toEqual(['Ending equity after assessed taxes', '$1,008.50', '$1,008.50'])
    expect(report.chart.series[0]!.points).toEqual([
      { x: 0, y: 100_000 },
      { x: 1, y: 100_850 },
    ])
    expect(report.chart.formatValue(100_850)).toBe('$1,008.50')
    expect(report.events.rows[0]!.cells[2]).toBe(
      'Partial-year gain-tax settlement',
    )
    expect(report.annual.rows[0]!.cells[0]).toContain('(partial)')
    for (const table of [
      report.summary,
      report.annual,
      report.monthly,
      report.assets,
      report.events,
    ])
      for (const row of table.rows)
        expect(row.cells).toHaveLength(table.columns.length)
  })

  it('reports malformed money, rates and partial numeric fields without coercing them to zero', () => {
    const draft = createPortfolioDraft()
    draft.years = ''
    draft.additionalMonths = '12'
    draft.ordinaryTaxRate = 'NaN'
    draft.accounts[0]!.assets[0]!.costBasisCents = '1.001'
    draft.accounts[0]!.startingCashCents = '$1'
    const outcome = evaluatePortfolio(draft)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.map((error) => error.path)).toEqual([
      'years',
      'additionalMonths',
      'ordinaryTaxRate',
      'accounts[0].startingCashCents',
      'accounts[0].assets[0].costBasisCents',
    ])
  })

  it('delegates numeric range, allocations, and dates to the engine', () => {
    const draft = createPortfolioDraft()
    draft.startMonth = 'not-a-date'
    draft.years = '100'
    draft.additionalMonths = '1'
    draft.accounts[0]!.assets[0]!.targetWeight = '50'
    draft.qualifiedDividendTaxRate = '101'
    const outcome = evaluatePortfolio(draft)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok)
      expect(outcome.errors.map((error) => error.path)).toEqual([
        'startMonth',
        'months',
        'qualifiedDividendTaxRate',
        'accounts[0].assets',
      ])
  })

  it('makes independent synthetic accounts and aggregates holdings, not alternatives', () => {
    const first = createPortfolioDraft()
    const second = createPortfolioDraft()
    first.accounts[0]!.name = 'Changed'
    expect(second.accounts[0]!.name).not.toBe('Changed')
    first.accounts.push(newAccount('account-2'))
    const added = newAsset('asset-2')
    expect(added.marketValueCents).toBe('0')
    expect(added.targetWeight).toBe('0')
    const outcome = evaluatePortfolio(first)
    if (!outcome.ok) throw new Error('Expected valid fixture')
    expect(outcome.projection.totals.equityCents).toBe(
      outcome.projection.accounts[0]!.totals.equityCents * 2,
    )
    const report = preparePortfolioReport(
      outcome.projection,
      'account-2',
      '2026',
    )
    expect(report.selectedAccount).toBe('account-2')
    expect(
      report.assets.rows.every((row) => row.cells[1] === 'Brokerage account-2'),
    ).toBe(true)
    const fallback = preparePortfolioReport(
      outcome.projection,
      'deleted-account',
      'wrong-year',
    )
    expect(fallback.selectedAccount).toBe('total')
    expect(fallback.selectedYear).toBe('2026')
  })

  it('filters detailed ledgers by selected calendar year and preserves all chart months', () => {
    const draft = createPortfolioDraft()
    draft.startMonth = '2026-12'
    const outcome = evaluatePortfolio(draft)
    if (!outcome.ok) throw new Error('Expected valid fixture')
    const report = preparePortfolioReport(outcome.projection, 'total', '2027')
    expect(report.monthly.rows).toHaveLength(11)
    expect(report.assets.rows).toHaveLength(11)
    expect(report.annual.rows).toHaveLength(2)
    expect(report.chart.series[0]!.points).toHaveLength(13)
  })
})
