import { describe, expect, it } from 'vitest'
import { runGrowthProjection } from './index'
import type { GrowthInput, GrowthProjection } from './types'

const base: GrowthInput = {
  startingBalanceCents: 100_000,
  monthlyContributionCents: 0,
  monthlyWithdrawalCents: 0,
  months: 12,
  annualReturnRate: 0,
  annualInflationRate: 0,
  annualFundExpenseRatio: 0,
  annualAdvisoryFeeRate: 0,
  returnBasis: 'before-fund-expenses',
  cashFlowTiming: 'end',
}

function project(overrides: Partial<GrowthInput> = {}): GrowthProjection {
  const result = runGrowthProjection({ ...base, ...overrides })
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.projection
}

describe('monthly growth engine', () => {
  it('runs headlessly and preserves its input', () => {
    const input = Object.freeze({ ...base })
    const first = runGrowthProjection(input)
    expect(runGrowthProjection(input)).toEqual(first)
    expect(input).toEqual(base)
    expect(first.ok).toBe(true)
  })

  it('returns the opening balance for a zero-month projection', () => {
    const result = project({ months: 0 })
    expect(result.monthly).toEqual([])
    expect(result.annual).toEqual([])
    expect(result.totals.closingBalanceCents).toBe(100_000)
    expect(result.totals.realClosingBalanceCents).toBe(100_000)
  })

  it('reconciles fixed deposits and withdrawals at zero return', () => {
    const result = project({
      monthlyContributionCents: 10_000,
      monthlyWithdrawalCents: 4_000,
    })
    expect(result.totals.closingBalanceCents).toBe(172_000)
    expect(result.totals.contributionsCents).toBe(120_000)
    expect(result.totals.withdrawalsCents).toBe(48_000)
  })

  it('converts effective annual return rather than dividing it by twelve', () => {
    const result = project({ annualReturnRate: 0.12 })
    expect(
      Math.abs(result.totals.closingBalanceCents - 112_000),
    ).toBeLessThanOrEqual(6)
    expect(result.totals.closingBalanceCents).toBeLessThan(112_683)
  })

  it.each([
    ['end', 11_100],
    ['beginning', 11_110],
  ] as const)(
    'applies %s-of-month contributions',
    (cashFlowTiming, expected) => {
      const result = project({
        startingBalanceCents: 10_000,
        months: 1,
        monthlyContributionCents: 1_000,
        annualReturnRate: 1.01 ** 12 - 1,
        cashFlowTiming,
      })
      expect(result.totals.closingBalanceCents).toBe(expected)
    },
  )

  it.each([
    ['end', 9_100],
    ['beginning', 9_090],
  ] as const)('applies %s-of-month withdrawals', (cashFlowTiming, expected) => {
    const result = project({
      startingBalanceCents: 10_000,
      months: 1,
      monthlyWithdrawalCents: 1_000,
      annualReturnRate: 1.01 ** 12 - 1,
      cashFlowTiming,
    })
    expect(result.totals.closingBalanceCents).toBe(expected)
  })

  it('charges both modeled fee categories against the same post-return balance', () => {
    const result = project({
      months: 1,
      annualFundExpenseRatio: 0.12,
      annualAdvisoryFeeRate: 0.24,
    })
    expect(result.totals.fundFeesCents).toBe(1_000)
    expect(result.totals.advisoryFeesCents).toBe(2_000)
    expect(result.totals.closingBalanceCents).toBe(97_000)
  })

  it('does not subtract fund expenses twice when returns already include them', () => {
    const result = project({
      months: 1,
      returnBasis: 'after-fund-expenses',
      annualFundExpenseRatio: 0.12,
      annualAdvisoryFeeRate: 0.24,
    })
    expect(result.totals.fundFeesCents).toBe(0)
    expect(result.totals.advisoryFeesCents).toBe(2_000)
    expect(result.totals.closingBalanceCents).toBe(98_000)
    expect(result.assumptions.annualFundExpenseRatio).toBe(0.12)
  })

  it('rounds a half-cent monthly fee up to one cent', () => {
    const result = project({
      months: 1,
      startingBalanceCents: 100,
      annualAdvisoryFeeRate: 0.06,
    })
    expect(result.totals.advisoryFeesCents).toBe(1)
    expect(result.totals.closingBalanceCents).toBe(99)
  })

  it('rounds negative half-cent growth away from zero', () => {
    const result = project({
      months: 1,
      startingBalanceCents: 1,
      annualReturnRate: 0.5 ** 12 - 1,
    })
    expect(result.totals.growthCents).toBe(-1)
    expect(result.totals.closingBalanceCents).toBe(0)
  })

  it('funds what is available and continues reporting unmet withdrawals', () => {
    const result = project({ months: 3, monthlyWithdrawalCents: 60_000 })
    expect(result.monthly.map((row) => row.withdrawalsCents)).toEqual([
      60_000, 40_000, 0,
    ])
    expect(result.monthly.map((row) => row.shortfallCents)).toEqual([
      0, 20_000, 60_000,
    ])
    expect(result.firstShortfallMonth).toBe(2)
    expect(result.totals.shortfallCents).toBe(80_000)
    expect(result.totals.closingBalanceCents).toBe(0)
  })

  it('uses each new contribution even after depletion', () => {
    const result = project({
      months: 2,
      startingBalanceCents: 0,
      monthlyContributionCents: 1_000,
      monthlyWithdrawalCents: 2_000,
    })
    expect(result.monthly.map((row) => row.withdrawalsCents)).toEqual([
      1_000, 1_000,
    ])
    expect(result.totals.shortfallCents).toBe(2_000)
  })

  it('handles a complete investment loss without a negative balance', () => {
    const result = project({ annualReturnRate: -1, months: 1 })
    expect(result.totals.growthCents).toBe(-100_000)
    expect(result.totals.closingBalanceCents).toBe(0)
  })

  it('discounts closing balances for inflation but does not change fixed cash flows', () => {
    const result = project({
      startingBalanceCents: 112_000,
      annualInflationRate: 0.12,
    })
    expect(result.totals.closingBalanceCents).toBe(112_000)
    expect(result.totals.realClosingBalanceCents).toBe(100_000)
    expect(result.totals.contributionsCents).toBe(0)
  })

  it('supports deflation as an explicit assumption', () => {
    const result = project({ annualInflationRate: -0.2 })
    expect(result.totals.realClosingBalanceCents).toBe(125_000)
  })

  it('discounts each month of growth before summing rather than discounting the final sum', () => {
    const result = project({
      startingBalanceCents: 10_000,
      months: 2,
      annualReturnRate: 1.1 ** 12 - 1,
      annualInflationRate: 1.1 ** 12 - 1,
    })
    expect(result.engineVersion).toBe('growth-1.1.0')
    expect(result.monthly.map((row) => row.growthCents)).toEqual([1_000, 1_100])
    expect(result.monthly.map((row) => row.realGrowthCents)).toEqual([909, 909])
    expect(result.annual[0]?.realGrowthCents).toBe(1_818)
    expect(result.totals.realGrowthCents).toBe(1_818)
    expect(result.totals.realClosingBalanceCents).toBe(10_000)
  })

  it('discounts negative growth and retains its sign', () => {
    const result = project({
      startingBalanceCents: 10_000,
      months: 1,
      annualReturnRate: 0.9 ** 12 - 1,
      annualInflationRate: 1.1 ** 12 - 1,
    })
    expect(result.totals.growthCents).toBe(-1_000)
    expect(result.totals.realGrowthCents).toBe(-909)
  })

  it('applies deflation to growth without changing the nominal ledger or fee basis', () => {
    const result = project({
      startingBalanceCents: 10_000,
      months: 1,
      annualReturnRate: 1.1 ** 12 - 1,
      annualInflationRate: 0.9 ** 12 - 1,
      annualAdvisoryFeeRate: 0.12,
    })
    expect(result.totals.realGrowthCents).toBe(1_111)
    expect(result.totals.growthCents).toBe(1_000)
    expect(result.totals.advisoryFeesCents).toBe(110)
    expect(result.totals.closingBalanceCents).toBe(10_890)
  })

  it('summarizes real growth across partial years and zero inflation', () => {
    const result = project({ months: 13, annualReturnRate: 0.06 })
    expect(result.totals.realGrowthCents).toBe(result.totals.growthCents)
    expect(result.annual[1]?.realGrowthCents).toBe(
      result.monthly[12]?.growthCents,
    )
    expect(
      result.annual.reduce((sum, row) => sum + row.realGrowthCents, 0),
    ).toBe(result.totals.realGrowthCents)
    expect(project({ months: 0 }).totals.realGrowthCents).toBe(0)
  })

  it('reports real growth overflow even if withdrawals leave a zero closing balance', () => {
    const result = runGrowthProjection({
      ...base,
      startingBalanceCents: 1_000_000_000_000_000,
      monthlyWithdrawalCents: 2_000_000_000_000_000,
      months: 1,
      annualReturnRate: 2 ** 12 - 1,
      annualInflationRate: -0.999999999999999,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.field).toBe('calculation')
  })

  it('summarizes full and partial projection years without summing balances', () => {
    const result = project({ months: 13, monthlyContributionCents: 100 })
    expect(result.annual).toHaveLength(2)
    expect(result.annual[0]).toMatchObject({
      year: 1,
      startMonth: 1,
      endMonth: 12,
      openingBalanceCents: 100_000,
      contributionsCents: 1_200,
      closingBalanceCents: 101_200,
    })
    expect(result.annual[1]).toMatchObject({
      year: 2,
      startMonth: 13,
      endMonth: 13,
      openingBalanceCents: 101_200,
      contributionsCents: 100,
      closingBalanceCents: 101_300,
    })
  })

  it.each(['beginning', 'end'] as const)(
    'reconciles every ledger row and totals for %s cash flows',
    (cashFlowTiming) => {
      const result = project({
        months: 48,
        monthlyContributionCents: 321,
        monthlyWithdrawalCents: 7_654,
        annualReturnRate: -0.1,
        annualInflationRate: 0.03,
        annualFundExpenseRatio: 0.002,
        annualAdvisoryFeeRate: 0.005,
        cashFlowTiming,
      })
      for (const row of [...result.monthly, ...result.annual, result.totals]) {
        expect(
          row.openingBalanceCents +
            row.contributionsCents +
            row.growthCents -
            row.fundFeesCents -
            row.advisoryFeesCents -
            row.withdrawalsCents,
        ).toBe(row.closingBalanceCents)
        expect(row.requestedWithdrawalsCents).toBe(
          row.withdrawalsCents + row.shortfallCents,
        )
        expect(row.closingBalanceCents).toBeGreaterThanOrEqual(0)
      }
      expect(result.totals.growthCents).toBe(
        result.monthly.reduce((sum, row) => sum + row.growthCents, 0),
      )
    },
  )

  it('reports unsupported numeric range instead of returning infinity or partial success', () => {
    const result = runGrowthProjection({
      ...base,
      annualReturnRate: Number.MAX_VALUE,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.field).toBe('calculation')
  })

  it('reports inflation underflow instead of returning infinite purchasing power', () => {
    expect(
      runGrowthProjection({
        ...base,
        months: 1_200,
        annualInflationRate: -0.999999,
      }).ok,
    ).toBe(false)
  })
})

describe('public input validation', () => {
  it.each([
    null,
    [],
    {},
    { ...base, startingBalanceCents: -1 },
    { ...base, startingBalanceCents: 0.5 },
    { ...base, startingBalanceCents: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, monthlyContributionCents: -1 },
    { ...base, monthlyWithdrawalCents: '100' },
    { ...base, months: 1.5 },
    { ...base, months: -1 },
    { ...base, months: 1_201 },
    { ...base, annualReturnRate: -1.01 },
    { ...base, annualReturnRate: Infinity },
    { ...base, annualInflationRate: -1 },
    { ...base, annualInflationRate: NaN },
    { ...base, annualFundExpenseRatio: -0.1 },
    { ...base, annualAdvisoryFeeRate: 1.01 },
    { ...base, returnBasis: 'unknown' },
    { ...base, cashFlowTiming: 'daily' },
    { ...base, unexpectedSetting: true },
  ])('rejects invalid input %# with explicit errors', (input) => {
    const result = runGrowthProjection(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0)
  })
})
