import { describe, expect, it } from 'vitest'
import { compareAmounts } from './comparison'

describe('scenario differences', () => {
  it.each([
    [10_000, 12_000, 2_000, 0.2],
    [10_000, 8_000, -2_000, -0.2],
    [10_000, 10_000, 0, 0],
    [10_000, -5_000, -15_000, -1.5],
    [0, 10_000, 10_000, null],
    [0, 0, 0, null],
    [-10_000, -5_000, 5_000, null],
  ])(
    'compares A=%s with B=%s without ranking the outcome',
    (a, b, amountCents, rate) => {
      expect(compareAmounts(a, b)).toEqual({ ok: true, amountCents, rate })
    },
  )

  it.each([
    [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER],
    [NaN, 100],
    [100, Infinity],
    [0.5, 100],
  ])('reports unsupported differences for %s and %s', (a, b) => {
    expect(compareAmounts(a, b)).toEqual({
      ok: false,
      message: 'Difference exceeds the supported integer-cent range.',
    })
  })
})
