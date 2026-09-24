import { runGrowthProjection } from '../../../domain/growth'
import { parseMoney, parsePercentage } from '../../../shared/numbers'
export { formatMoney } from '../../../shared/numbers'
import type {
  GrowthInput,
  ProjectionOutcome,
  ValidationIssue,
} from '../../../domain/growth'

export type ScenarioValues = Record<
  Exclude<keyof GrowthInput, 'months'>,
  string
>
export interface ScenarioDraft {
  id: string
  label: string
  values: ScenarioValues
}
export interface TableRowView {
  id: string
  cells: readonly string[]
}

export const numericFields = [
  {
    key: 'startingBalanceCents',
    label: 'Starting balance (USD)',
    hint: 'Nonnegative dollars; up to two decimal places.',
  },
  {
    key: 'monthlyContributionCents',
    label: 'Monthly contribution (USD)',
    hint: 'Fixed nominal dollars throughout this projection.',
  },
  {
    key: 'monthlyWithdrawalCents',
    label: 'Monthly withdrawal (USD)',
    hint: 'Requested spending; any unfunded amount becomes a reported shortfall.',
  },
  {
    key: 'annualReturnRate',
    label: 'Annual return assumption (%)',
    hint: 'Effective annual return before additional advisory fees. Not a market prediction.',
  },
  {
    key: 'annualInflationRate',
    label: 'Annual inflation assumption (%)',
    hint: 'Used to express balances and growth in starting-period purchasing power. Not a forecast.',
  },
  {
    key: 'annualFundExpenseRatio',
    label: 'Annual fund expense ratio (%)',
    hint: 'From a fund fact sheet or prospectus. Deducted only for before-expense returns.',
  },
  {
    key: 'annualAdvisoryFeeRate',
    label: 'Additional annual fee (%)',
    hint: 'Advisory/account percentage from a fee schedule; modeled monthly, not exact billing.',
  },
] satisfies { key: keyof ScenarioValues; label: string; hint: string }[]

export const choiceFields = [
  {
    key: 'returnBasis',
    label: 'Return assumption includes fund expenses?',
    hint: 'Published fund returns generally already reflect fund expenses. Do not deduct them twice.',
    options: [
      { value: 'after-fund-expenses', label: 'Yes, already included' },
      { value: 'before-fund-expenses', label: 'No, deduct fund expenses' },
    ],
  },
  {
    key: 'cashFlowTiming',
    label: 'Monthly cash-flow timing',
    hint: 'Contributions occur before withdrawals at the chosen point in the month.',
    options: [
      { value: 'end', label: 'End of month' },
      { value: 'beginning', label: 'Beginning of month' },
    ],
  },
] satisfies {
  key: keyof ScenarioValues
  label: string
  hint: string
  options: { value: string; label: string }[]
}[]

const exampleValues: ScenarioValues = {
  startingBalanceCents: '10000',
  monthlyContributionCents: '250',
  monthlyWithdrawalCents: '0',
  annualReturnRate: '5',
  annualInflationRate: '2',
  annualFundExpenseRatio: '0.20',
  annualAdvisoryFeeRate: '0',
  returnBasis: 'after-fund-expenses',
  cashFlowTiming: 'end',
}

export const exampleScenarios: readonly ScenarioDraft[] = [
  { id: 'baseline', label: 'Scenario A', values: { ...exampleValues } },
  {
    id: 'alternative',
    label: 'Scenario B',
    values: { ...exampleValues, monthlyContributionCents: '350' },
  },
]

function readMoney(
  value: string,
  field: keyof GrowthInput,
  errors: ValidationIssue[],
) {
  const parsed = parseMoney(value)
  if (!parsed.ok) {
    errors.push({ field, message: parsed.error })
    return undefined
  }
  return parsed.value
}

function readRate(
  value: string,
  field: keyof GrowthInput,
  errors: ValidationIssue[],
) {
  const parsed = parsePercentage(value)
  if (!parsed.ok) {
    errors.push({ field, message: parsed.error })
    return undefined
  }
  return parsed.value
}

export function evaluateScenario(
  values: ScenarioValues,
  months: string,
): ProjectionOutcome {
  const errors: ValidationIssue[] = []
  const input = {
    startingBalanceCents: readMoney(
      values.startingBalanceCents,
      'startingBalanceCents',
      errors,
    ),
    monthlyContributionCents: readMoney(
      values.monthlyContributionCents,
      'monthlyContributionCents',
      errors,
    ),
    monthlyWithdrawalCents: readMoney(
      values.monthlyWithdrawalCents,
      'monthlyWithdrawalCents',
      errors,
    ),
    annualReturnRate: readRate(
      values.annualReturnRate,
      'annualReturnRate',
      errors,
    ),
    annualInflationRate: readRate(
      values.annualInflationRate,
      'annualInflationRate',
      errors,
    ),
    annualFundExpenseRatio: readRate(
      values.annualFundExpenseRatio,
      'annualFundExpenseRatio',
      errors,
    ),
    annualAdvisoryFeeRate: readRate(
      values.annualAdvisoryFeeRate,
      'annualAdvisoryFeeRate',
      errors,
    ),
    months: Number(months),
    cashFlowTiming: values.cashFlowTiming,
    returnBasis: values.returnBasis,
  }
  if (!/^\d+$/.test(months.trim())) {
    errors.push({
      field: 'months',
      message: 'Enter a whole number of months from 0 to 1200.',
    })
  }
  return errors.length ? { ok: false, errors } : runGrowthProjection(input)
}
