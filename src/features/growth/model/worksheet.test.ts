import { describe, expect, it } from 'vitest'
import { evaluateScenario, exampleScenarios, formatMoney } from './worksheet'

describe('worksheet input boundary', () => {
  const example = exampleScenarios[0]
  if (!example) throw new Error('A synthetic example is required.')

  it('converts dollars to cents and percentages to fractions', () => {
    const result = evaluateScenario(
      {
        ...example.values,
        startingBalanceCents: '123.45',
        annualReturnRate: '6',
      },
      '12',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.projection.assumptions.startingBalanceCents).toBe(12_345)
      expect(result.projection.assumptions.annualReturnRate).toBe(0.06)
    }
  })

  it.each(['', '12.345', '-1', '1,000', '12usd', '1e3'])(
    'rejects malformed money %s rather than coercing it',
    (value) => {
      const result = evaluateScenario(
        { ...example.values, startingBalanceCents: value },
        '12',
      )
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.errors[0]?.field).toBe('startingBalanceCents')
    },
  )

  it('does not interpret an empty rate as zero', () => {
    expect(
      evaluateScenario({ ...example.values, annualReturnRate: '' }, '12').ok,
    ).toBe(false)
  })

  it('rejects partial months and unsupported timing', () => {
    expect(evaluateScenario(example.values, '1.5').ok).toBe(false)
    expect(
      evaluateScenario({ ...example.values, cashFlowTiming: 'daily' }, '12').ok,
    ).toBe(false)
  })

  it('uses the same engine validation for limits', () => {
    const result = evaluateScenario(example.values, '1201')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.field).toBe('months')
  })

  it('formats cents as USD without altering the calculation result', () => {
    expect(formatMoney(12_345)).toBe('$123.45')
    expect(formatMoney(-101)).toBe('-$1.01')
  })

  it('preserves every cent at the supported integer limits and below one dollar', () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('$90,071,992,547,409.91')
    expect(formatMoney(-Number.MAX_SAFE_INTEGER)).toBe(
      '-$90,071,992,547,409.91',
    )
    expect(formatMoney(-1)).toBe('-$0.01')
    expect(formatMoney(0)).toBe('$0.00')
  })
})
