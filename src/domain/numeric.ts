export class NumericRangeError extends Error {}

/** Safe integer cents, with half-cent ties rounded away from zero. */
export function cents(value: number): number {
  const rounded = Math.sign(value) * Math.round(Math.abs(value))
  if (!Number.isSafeInteger(rounded)) throw new NumericRangeError()
  return rounded === 0 ? 0 : rounded
}

export function effectiveMonthlyRate(annualRate: number): number {
  return Math.expm1(Math.log1p(annualRate) / 12)
}

export function inflationFactor(annualRate: number, month: number): number {
  const factor = Math.exp((Math.log1p(annualRate) * month) / 12)
  if (!Number.isFinite(factor) || factor <= 0) throw new NumericRangeError()
  return factor
}
