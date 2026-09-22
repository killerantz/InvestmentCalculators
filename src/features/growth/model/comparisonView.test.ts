import { describe, expect, it } from 'vitest'
import { runGrowthProjection, type GrowthInput } from '../../../domain/growth'
import {
  buildChartData,
  buildLedger,
  buildSummaryRows,
  formatDifference,
  type ScenarioPair,
} from './comparisonView'

const input: GrowthInput = {
  startingBalanceCents: 10_000,
  monthlyContributionCents: 0,
  monthlyWithdrawalCents: 0,
  months: 2,
  annualReturnRate: 1.1 ** 12 - 1,
  annualInflationRate: 1.1 ** 12 - 1,
  annualFundExpenseRatio: 0,
  annualAdvisoryFeeRate: 0,
  returnBasis: 'after-fund-expenses',
  cashFlowTiming: 'end',
}

function scenario(id: string, overrides: Partial<GrowthInput> = {}) {
  const outcome = runGrowthProjection({ ...input, ...overrides })
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
  return { id, label: `Scenario ${id}`, projection: outcome.projection }
}

const pair: ScenarioPair = [scenario('A'), scenario('B')]
const compact = { cashFlows: false, fees: false, todaysDollars: false }

describe('comparison presentation', () => {
  it('formats signed differences, including meaningful small percentages', () => {
    expect(formatDifference(10_000, 12_000)).toEqual(['+$20.00', '+20%'])
    expect(formatDifference(10_000, 8_000)).toEqual(['-$20.00', '-20%'])
    expect(formatDifference(10_000, 10_000)).toEqual(['$0.00', '0%'])
    expect(formatDifference(1_000_000, 1_000_001)).toEqual([
      '+$0.01',
      '+<0.01%',
    ])
    expect(formatDifference(1_000_000, 999_999)).toEqual(['-$0.01', '-<0.01%'])
  })

  it('does not substitute misleading percentages or overflowed amounts', () => {
    expect(formatDifference(0, 100)).toEqual(['+$1.00', 'N/A'])
    expect(formatDifference(-100, 100)).toEqual(['+$2.00', 'N/A'])
    expect(formatDifference(0, Number.MAX_SAFE_INTEGER)).toEqual([
      '+$90,071,992,547,409.91',
      'N/A',
    ])
    expect(
      formatDifference(Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER),
    ).toEqual(['Difference exceeds the supported integer-cent range.', 'N/A'])
  })

  it('gives identical scenarios zero differences without totaling alternatives', () => {
    const rows = buildSummaryRows(pair)
    expect(rows.find((row) => row.id === 'closingBalanceCents')?.cells).toEqual(
      ['Ending balance (nominal)', '$121.00', '$121.00', '$0.00', '0%'],
    )
    expect(rows.find((row) => row.id === 'realGrowthCents')?.cells).toEqual([
      "Modeled investment growth (today's dollars)",
      '$18.18',
      '$18.18',
      '$0.00',
      '0%',
    ])
    expect(rows.find((row) => row.id === 'first-shortfall')?.cells).toEqual([
      'First shortfall',
      'None in this projection',
      'None in this projection',
      'N/A',
      'N/A',
    ])
    expect(rows.every((row) => row.cells.length === 5)).toBe(true)
  })

  it('displays shortfall months without treating their difference as money', () => {
    const rows = buildSummaryRows([
      scenario('A', { monthlyWithdrawalCents: 20_000 }),
      scenario('B', { monthlyWithdrawalCents: 0 }),
    ])
    expect(rows.at(-1)?.cells).toEqual([
      'First shortfall',
      'Month 1',
      'None in this projection',
      'N/A',
      'N/A',
    ])
  })
})

describe('trend data', () => {
  it.each([
    ['closing', 'nominal', [100, 110, 121]],
    ['closing', 'today', [100, 100, 100]],
    ['growth', 'nominal', [0, 10, 21]],
    ['growth', 'today', [0, 9.09, 18.18]],
  ] as const)(
    'prepares %s in %s dollars, including the starting point',
    (metric, basis, expected) => {
      const chart = buildChartData(pair, metric, basis)
      expect(chart.series[0]?.points.map((point) => point.x)).toEqual([0, 1, 2])
      expect(chart.series[0]?.points.map((point) => point.y)).toEqual(expected)
      expect(chart.series[1]?.points).toEqual(chart.series[0]?.points)
      expect(chart.rows).toHaveLength(3)
      expect(chart.rows.at(-1)?.cells[1]).toBe(
        metric === 'growth' && basis === 'today'
          ? '$18.18'
          : metric === 'growth'
            ? '$21.00'
            : basis === 'today'
              ? '$100.00'
              : '$121.00',
      )
    },
  )

  it('uses each scenario inflation assumption independently', () => {
    const chart = buildChartData(
      [scenario('A'), scenario('B', { annualInflationRate: 0 })],
      'closing',
      'today',
    )
    expect(chart.series[0]?.points.at(-1)?.y).toBe(100)
    expect(chart.series[1]?.points.at(-1)?.y).toBe(121)
  })

  it('shows zero-duration starting balances and zero growth, not empty or invented paths', () => {
    const zeroPair: ScenarioPair = [
      scenario('A', { months: 0 }),
      scenario('B', { months: 0 }),
    ]
    expect(
      buildChartData(zeroPair, 'closing', 'today').series[0]?.points,
    ).toEqual([{ x: 0, y: 100 }])
    expect(
      buildChartData(zeroPair, 'growth', 'today').series[0]?.points,
    ).toEqual([{ x: 0, y: 0 }])
  })

  it('retains negative growth and the final month of the maximum horizon', () => {
    const longPair: ScenarioPair = [
      scenario('A', {
        months: 1200,
        annualReturnRate: -0.1,
        annualInflationRate: 0,
      }),
      scenario('B', {
        months: 1200,
        annualReturnRate: 0,
        annualInflationRate: 0,
      }),
    ]
    const chart = buildChartData(longPair, 'growth', 'nominal')
    expect(chart.series[0]?.points).toHaveLength(1201)
    expect(chart.series[0]?.points.at(-1)?.x).toBe(1200)
    expect(chart.series[0]?.points.at(-1)?.y).toBe(
      longPair[0].projection.totals.growthCents / 100,
    )
    expect(chart.series[0]?.points.at(-1)?.y).toBeLessThan(0)
  })

  it('refuses mismatched projection horizons instead of pairing unrelated points', () => {
    expect(() =>
      buildChartData(
        [scenario('A'), scenario('B', { months: 1 })],
        'closing',
        'nominal',
      ),
    ).toThrow('Scenario comparisons require matching projection horizons.')
  })
})

describe('ledger presentation', () => {
  it('defaults to period growth and closing balance, not cumulative growth', () => {
    const ledger = buildLedger(pair[0].projection, 'monthly', 1, compact)
    expect(ledger.columns).toEqual([
      'Period',
      'Growth (nominal)',
      'Closing (nominal)',
    ])
    expect(ledger.rows[1]?.cells).toEqual(['Month 2', '$11.00', '$121.00'])
  })

  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    'keeps columns and rows aligned for visibility combination %s',
    (mask) => {
      const ledger = buildLedger(pair[0].projection, 'annual', 1, {
        cashFlows: Boolean(mask & 1),
        fees: Boolean(mask & 2),
        todaysDollars: Boolean(mask & 4),
      })
      expect(ledger.columns).toHaveLength(
        3 + (mask & 1 ? 5 : 0) + (mask & 2 ? 2 : 0) + (mask & 4 ? 2 : 0),
      )
      expect(
        ledger.rows.every((row) => row.cells.length === ledger.columns.length),
      ).toBe(true)
      if (mask & 4)
        expect(ledger.rows[0]?.cells.slice(-2)).toEqual(['$18.18', '$100.00'])
    },
  )

  it('limits monthly rows to the selected partial or final projection year', () => {
    const partial = scenario('A', { months: 13 }).projection
    expect(
      buildLedger(partial, 'monthly', 2, compact).rows.map((row) => row.id),
    ).toEqual(['13'])
    const long = scenario('A', {
      months: 1200,
      annualReturnRate: 0,
      annualInflationRate: 0,
    }).projection
    const rows = buildLedger(long, 'monthly', 100, compact).rows
    expect(rows).toHaveLength(12)
    expect(rows[0]?.cells[0]).toBe('Month 1189')
    expect(rows.at(-1)?.cells[0]).toBe('Month 1200')
  })

  it.each([0, 2, 1.5, NaN])('rejects an invalid monthly year %s', (year) => {
    expect(() =>
      buildLedger(pair[0].projection, 'monthly', year, compact),
    ).toThrow('Choose an available whole projection year.')
  })

  it('keeps empty ledgers empty at zero duration', () => {
    const projection = scenario('A', { months: 0 }).projection
    expect(buildLedger(projection, 'annual', 1, compact).rows).toEqual([])
    expect(buildLedger(projection, 'monthly', 1, compact).rows).toEqual([])
  })
})
