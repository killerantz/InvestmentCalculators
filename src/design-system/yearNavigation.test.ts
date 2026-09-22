import { describe, expect, it } from 'vitest'
import { parseYearDraft, validateYearBounds } from './yearNavigation'

describe('year navigation', () => {
  it.each(['1', '50', '100', ' 25 ', '001'])(
    'accepts exact integer entry %s',
    (draft) => {
      expect(parseYearDraft(draft, 100)).toEqual({ year: Number(draft) })
    },
  )

  it.each([
    '',
    ' ',
    '-',
    '0',
    '-1',
    '101',
    '1.5',
    '1.0',
    '1e2',
    'Infinity',
    'NaN',
    'year 2',
    '9007199254740992',
  ])('rejects %s without clamping or emitting a year', (draft) => {
    const result = parseYearDraft(draft, 100)
    expect(result.error).toMatch(/Enter a (whole )?year from 1 to 100\./)
    expect(result).not.toHaveProperty('year')
  })

  it('adapts selected years when the maximum shrinks', () => {
    expect(validateYearBounds(80, 100)).toBe(80)
    expect(validateYearBounds(80, 30)).toBe(30)
    expect(parseYearDraft('80', 30)).toEqual({
      error: 'Enter a year from 1 to 30.',
    })
  })

  it('supports the one-year range', () => {
    expect(validateYearBounds(1, 1)).toBe(1)
    expect(parseYearDraft('1', 1)).toEqual({ year: 1 })
    expect(parseYearDraft('2', 1)).toEqual({
      error: 'Enter a year from 1 to 1.',
    })
  })

  it('supports three digits but rejects larger bounds and overlong drafts', () => {
    expect(validateYearBounds(999, 999)).toBe(999)
    expect(parseYearDraft('999', 999)).toEqual({ year: 999 })
    expect(() => validateYearBounds(1, 1000)).toThrow(/max/)
    expect(parseYearDraft('0001', 999)).toEqual({
      error: 'Enter a whole year from 1 to 999.',
    })
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'reports invalid controlled bounds %s',
    (bound) => {
      expect(() => validateYearBounds(1, bound)).toThrow(/max/)
      expect(() => validateYearBounds(bound, 100)).toThrow(/value/)
    },
  )
})
