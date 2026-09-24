import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney, parsePercentage } from './numbers'

describe('shared numeric presentation', () => {
  it('formats safe-integer cents without floating dollar precision loss', () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('$90,071,992,547,409.91')
    expect(formatMoney(-1)).toBe('-$0.01')
  })
  it('parses explicit zeros and rejects invalid or overflowing amounts', () => {
    expect(parseMoney('0')).toEqual({ ok: true, value: 0 })
    expect(parseMoney('12.34')).toEqual({ ok: true, value: 1234 })
    expect(parseMoney('90071992547410')).toMatchObject({ ok: false })
    expect(parseMoney('')).toMatchObject({ ok: false })
    expect(parsePercentage('-0.5')).toEqual({ ok: true, value: -0.005 })
    expect(parsePercentage('1%')).toMatchObject({ ok: false })
  })
})
