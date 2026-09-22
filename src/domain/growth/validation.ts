import type { GrowthInput, ValidationIssue } from './types'

const moneyFields = [
  'startingBalanceCents',
  'monthlyContributionCents',
  'monthlyWithdrawalCents',
] as const
const feeFields = ['annualFundExpenseRatio', 'annualAdvisoryFeeRate'] as const
const knownFields = new Set([
  ...moneyFields,
  ...feeFields,
  'months',
  'annualReturnRate',
  'annualInflationRate',
  'returnBasis',
  'cashFlowTiming',
])

export function validateGrowthInput(
  input: unknown,
  errors: ValidationIssue[],
): input is GrowthInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    errors.push({ field: 'input', message: 'Provide a scenario object.' })
    return false
  }
  const values: Record<string, unknown> = { ...input }
  if (Object.keys(values).some((key) => !knownFields.has(key))) {
    errors.push({
      field: 'input',
      message: 'The scenario contains unsupported fields.',
    })
  }
  for (const field of moneyFields) {
    const value = values[field]
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      errors.push({
        field,
        message:
          'Enter a nonnegative amount in whole cents within the supported range.',
      })
    }
  }
  const months = values.months
  if (
    typeof months !== 'number' ||
    !Number.isInteger(months) ||
    months < 0 ||
    months > 1_200
  ) {
    errors.push({
      field: 'months',
      message: 'Enter a whole number of months from 0 to 1200.',
    })
  }
  for (const field of feeFields) {
    const value = values[field]
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      errors.push({
        field,
        message: 'Enter an annual fee between 0% and 100%.',
      })
    }
  }
  const growth = values.annualReturnRate
  if (typeof growth !== 'number' || !Number.isFinite(growth) || growth < -1) {
    errors.push({
      field: 'annualReturnRate',
      message: 'Enter a finite annual return of at least -100%.',
    })
  }
  const inflation = values.annualInflationRate
  if (
    typeof inflation !== 'number' ||
    !Number.isFinite(inflation) ||
    inflation <= -1
  ) {
    errors.push({
      field: 'annualInflationRate',
      message: 'Enter a finite annual inflation rate greater than -100%.',
    })
  }
  if (
    values.cashFlowTiming !== 'beginning' &&
    values.cashFlowTiming !== 'end'
  ) {
    errors.push({
      field: 'cashFlowTiming',
      message: 'Choose beginning or end of month.',
    })
  }
  if (
    values.returnBasis !== 'before-fund-expenses' &&
    values.returnBasis !== 'after-fund-expenses'
  ) {
    errors.push({
      field: 'returnBasis',
      message: 'Specify whether the return already includes fund expenses.',
    })
  }
  return errors.length === 0
}
