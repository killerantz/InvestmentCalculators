export function validateYearBounds(value: number, max: number) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 999) {
    throw new Error('YearNavigator max must be a whole number from 1 to 999.')
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('YearNavigator value must be a positive safe integer.')
  }
  return Math.min(value, max)
}

export function parseYearDraft(
  draft: string,
  max: number,
): { year: number; error?: never } | { error: string; year?: never } {
  validateYearBounds(1, max)
  const text = draft.trim()
  const year = Number(text)
  if (!/^\d{1,3}$/.test(text) || !Number.isSafeInteger(year)) {
    return { error: `Enter a whole year from 1 to ${max}.` }
  }
  if (year < 1 || year > max) {
    return { error: `Enter a year from 1 to ${max}.` }
  }
  return { year }
}
