import { runGrowthProjection } from '../../../domain/growth'
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
  const text = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    errors.push({
      field,
      message:
        'Enter nonnegative dollars with up to two decimal places, without commas or currency symbols.',
    })
    return undefined
  }
  const [whole, fraction = ''] = text.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(amount)) {
    errors.push({
      field,
      message: 'This amount exceeds the supported numeric range.',
    })
    return undefined
  }
  return amount
}

function readRate(
  value: string,
  field: keyof GrowthInput,
  errors: ValidationIssue[],
) {
  const text = value.trim()
  if (
    !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ||
    !Number.isFinite(Number(text))
  ) {
    errors.push({
      field,
      message:
        'Enter a finite percentage, such as 5 or 0.20, without a percent sign.',
    })
    return undefined
  }
  return Number(text) / 100
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

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
export function formatMoney(cents: number): string {
  const amount = BigInt(cents)
  const whole = amount / 100n
  const fraction = (amount < 0n ? -amount : amount) % 100n
  // Avoid losing a cent when converting large integer amounts to floating dollars.
  return currency
    .formatToParts(whole === 0n && amount < 0n ? -0 : whole)
    .map((part) =>
      part.type === 'fraction'
        ? fraction.toString().padStart(2, '0')
        : part.value,
    )
    .join('')
}
