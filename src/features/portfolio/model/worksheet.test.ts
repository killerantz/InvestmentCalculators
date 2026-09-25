import { describe, expect, it } from 'vitest'
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

describe('portfolio worksheet model', () => {
  it('duplicates an account immediately after its source with independent assets and all settings', () => {
    const draft = createPortfolioDraft()
    const source = draft.accounts[0]!
    source.startingCashCents = '10000'
    source.monthlyContributionCents = '100'
    source.newCashMode = 'hold'
    source.distributionMode = 'retain'
    source.rebalance = 'threshold'
    source.driftThreshold = '7'
    source.assets[0]!.targetWeight = '60'
    source.assets.push({
      ...newAsset('asset-2'),
      targetWeight: '40',
      marketValueCents: '200',
      costBasisCents: '150',
    })
    draft.accounts.push(newAccount('account-2'))
    const before = structuredClone(draft)
    const duplicated = duplicateAccount(draft, source.id)
    expect(draft).toEqual(before)
    expect(duplicated.accounts.map((account) => account.id)).toEqual([
      'account-1',
      'account-3',
      'account-2',
    ])
    const copy = duplicated.accounts[1]!
    expect(copy).toEqual({
      ...source,
      id: 'account-3',
      name: `${source.name} copy`,
    })
    expect(copy.assets).not.toBe(source.assets)
    copy.assets[0]!.marketValueCents = '500'
    copy.assets[1]!.name = 'Edited copied asset'
    copy.startingCashCents = '5'
    expect(draft).toEqual(before)
    expect(evaluatePortfolio(duplicated).ok).toBe(true)
  })

  it('duplicates an asset without changing its source, other accounts, or allocation weights', () => {
    const draft = createPortfolioDraft()
    draft.accounts.push(newAccount('account-2'))
    const before = structuredClone(draft)
    const duplicated = duplicateAsset(draft, 'account-1', 'asset-1')
    const source = duplicated.accounts[0]!.assets[0]!
    const copy = duplicated.accounts[0]!.assets[1]!
    expect(copy).toEqual({
      ...source,
      id: 'asset-2',
      name: `${source.name} copy`,
    })
    expect(copy).not.toBe(source)
    expect(duplicated.accounts[1]).toEqual(before.accounts[1])
    expect(draft).toEqual(before)
    const invalid = evaluatePortfolio(duplicated)
    expect(invalid.ok).toBe(false)
    if (!invalid.ok)
      expect(invalid.errors.map((error) => error.path)).toContain(
        'accounts[0].assets',
      )
    copy.targetWeight = '0'
    copy.marketValueCents = '250'
    expect(evaluatePortfolio(duplicated).ok).toBe(true)
    expect(draft).toEqual(before)
  })

  it('preserves incomplete numeric drafts when duplicating instead of coercing or calculating them', () => {
    const draft = createPortfolioDraft()
    draft.accounts[0]!.startingCashCents = ''
    draft.accounts[0]!.assets[0]!.annualPriceGrowthRate = '-'
    const accountCopy = duplicateAccount(draft, 'account-1').accounts[1]!
    expect(accountCopy.startingCashCents).toBe('')
    expect(accountCopy.assets[0]!.annualPriceGrowthRate).toBe('-')
    expect(
      duplicateAsset(draft, 'account-1', 'asset-1').accounts[0]!.assets[1]!
        .annualPriceGrowthRate,
    ).toBe('-')
  })

  it('keeps identifiers unique across repeated duplication and gaps left by removals', () => {
    let draft = createPortfolioDraft()
    draft = duplicateAccount(draft, 'account-1')
    draft = duplicateAccount(draft, 'account-1')
    draft.accounts = draft.accounts.filter(
      (account) => account.id !== 'account-2',
    )
    draft = duplicateAccount(draft, 'account-1')
    expect(new Set(draft.accounts.map((account) => account.id)).size).toBe(3)
    draft = duplicateAsset(draft, 'account-1', 'asset-1')
    draft = duplicateAsset(draft, 'account-1', 'asset-1')
    expect(draft.accounts[0]!.assets.map((asset) => asset.id)).toEqual([
      'asset-1',
      'asset-3',
      'asset-2',
    ])
    expect(uniqueId('asset', ['asset-1', 'asset-3'])).toBe('asset-2')
  })

  it('reports missing duplication targets explicitly', () => {
    const draft = createPortfolioDraft()
    expect(() => duplicateAccount(draft, 'missing')).toThrow(
      'Cannot duplicate missing account',
    )
    expect(() => duplicateAsset(draft, 'missing', 'asset-1')).toThrow(
      'Cannot duplicate asset in missing account',
    )
    expect(() => duplicateAsset(draft, 'account-1', 'missing')).toThrow(
      'Cannot duplicate missing asset',
    )
  })

  it.each(portfolioChartMetricOptions)(
    'charts separate accounts and their exact combined $label values',
    ({ value: metric }) => {
      const draft = createPortfolioDraft()
      draft.years = '2'
      draft.accounts[0]!.startingCashCents = '10000'
      draft.accounts[0]!.monthlyContributionCents = '100'
      const second = newAccount('account-2')
      second.startingCashCents = '10000'
      second.monthlyContributionCents = '100'
      second.newCashMode = 'hold'
      draft.accounts.push(second)
      const outcome = evaluatePortfolio(draft)
      if (!outcome.ok) throw new Error('Expected valid fixture')
      const projection = outcome.projection
      const report = preparePortfolioReport(
        projection,
        'account-2',
        '2027',
        'accounts',
        metric,
      )
      expect(report.chart.series.map((series) => series.id)).toEqual([
        'account-1',
        'account-2',
      ])
      expect(report.chart.series.map((series) => series.label)).toEqual(
        draft.accounts.map((account) => account.name),
      )
      expect(report.chart.series.map((series) => series.styleIndex)).toEqual([
        0, 1,
      ])
      for (const [index, series] of report.chart.series.entries()) {
        expect(series.points).toHaveLength(25)
        expect(series.points[0]).toEqual({
          x: 0,
          y:
            metric === 'endingCashCents'
              ? 1_000_000
              : metric === 'endingAssetsCents'
                ? 100_000
                : 1_100_000,
        })
        expect(series.points.slice(1)).toEqual(
          projection.accounts[index]!.monthly.map((row) => ({
            x: row.month,
            y: row[metric],
          })),
        )
      }
      const combined = preparePortfolioReport(
        projection,
        'account-2',
        '2027',
        'total',
        metric,
      )
      expect(combined.chart.series).toHaveLength(1)
      expect(combined.chart.series[0]!.label).toBe('All holdings combined')
      combined.chart.series[0]!.points.forEach((point, index) => {
        expect(point.y).toBe(
          report.chart.series.reduce(
            (sum, series) => sum + series.points[index]!.y,
            0,
          ),
        )
      })
      expect(report.monthly.rows).toHaveLength(12)
      expect(combined.monthly).toEqual(report.monthly)
      expect(
        preparePortfolioReport(projection, 'total', '2026', 'accounts', metric)
          .chart,
      ).toMatchObject({
        title: report.chart.title,
        series: report.chart.series,
      })
    },
  )

  it('defaults to after-tax value by account and distinguishes duplicate account names', () => {
    const draft = createPortfolioDraft()
    const second = newAccount('account-2')
    second.name = draft.accounts[0]!.name
    draft.accounts.push(second)
    const outcome = evaluatePortfolio(draft)
    if (!outcome.ok) throw new Error('Expected valid fixture')
    const report = preparePortfolioReport(outcome.projection, 'total', '')
    expect(report.chart.title).toBe(
      'By account: Total value after assessed taxes',
    )
    expect(
      new Set(report.chart.series.map((series) => series.label)).size,
    ).toBe(2)
    report.chart.series.forEach((series, index) => {
      expect(series.points.at(-1)!.y).toBe(
        outcome.projection.accounts[index]!.totals.equityCents,
      )
    })
  })

  it('defaults new accounts to investing new cash and preserves an explicit hold choice', () => {
    const draft = createPortfolioDraft()
    expect(newAccount('next').newCashMode).toBe('invest')
    draft.years = '10'
    const account = draft.accounts[0]!
    account.startingCashCents = '10000'
    account.monthlyContributionCents = '100'
    account.rebalance = 'threshold'
    account.assets[0]!.annualDistributionYield = '0'
    const invested = evaluatePortfolio(draft)
    if (!invested.ok) throw new Error('Expected valid fixture')
    expect(invested.projection.totals).toMatchObject({
      endingCashCents: 0,
      endingAssetsCents: 2_300_000,
      rebalanceCount: 0,
    })
    account.newCashMode = 'hold'
    const held = evaluatePortfolio(draft)
    if (!held.ok) throw new Error('Expected valid fixture')
    expect(held.projection.totals).toMatchObject({
      endingCashCents: 2_200_000,
      endingAssetsCents: 100_000,
      rebalanceCount: 0,
    })
    const report = preparePortfolioReport(held.projection, 'total', '')
    expect(report.summary.rows.every((row) => Boolean(row.help))).toBe(true)
  })

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
