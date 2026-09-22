import {
  compareAmounts,
  type GrowthProjection,
  type LedgerAmounts,
} from '../../../domain/growth'
import { formatMoney, type TableRowView } from './worksheet'

export interface ScenarioResult {
  id: string
  label: string
  projection: GrowthProjection
}
export type ScenarioPair = readonly [ScenarioResult, ScenarioResult]
export type ChartMetric = 'closing' | 'growth'
export type DollarBasis = 'nominal' | 'today'
export type LedgerMode = 'annual' | 'monthly'
export interface LedgerVisibility {
  cashFlows: boolean
  fees: boolean
  todaysDollars: boolean
}

export const chartMetricOptions = [
  { value: 'closing', label: 'Closing balance' },
  { value: 'growth', label: 'Cumulative growth' },
] as const
export const dollarBasisOptions = [
  { value: 'nominal', label: 'Nominal dollars' },
  { value: 'today', label: "Today's dollars" },
] as const
export const ledgerModeOptions = [
  { value: 'annual', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
] as const
export const ledgerVisibilityOptions = [
  { key: 'cashFlows', label: 'Opening balance and cash flows' },
  { key: 'fees', label: 'Fund deductions and additional fees' },
  { key: 'todaysDollars', label: "Today's-dollar growth and closing" },
] as const

export function selectedOption<T extends string>(
  options: readonly { value: T }[],
  value: string,
): T {
  const option = options.find((option) => option.value === value)
  if (!option) throw new Error(`Unsupported display option: ${value}`)
  return option.value
}

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})
const inflation = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 8,
})
const chartCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export const formatChartValue = (dollars: number) =>
  chartCurrency.format(dollars)
export const formatInflation = (rate: number) => inflation.format(rate)

export function formatDifference(
  aCents: number,
  bCents: number,
): readonly string[] {
  const difference = compareAmounts(aCents, bCents)
  if (!difference.ok) return [difference.message, 'N/A']
  const { amountCents, rate } = difference
  const amount = `${amountCents > 0 ? '+' : ''}${formatMoney(amountCents)}`
  const percentage =
    rate === null
      ? 'N/A'
      : rate !== 0 && Math.abs(rate) < 0.0001
        ? `${rate < 0 ? '-' : '+'}<0.01%`
        : percent.format(rate)
  return [amount, percentage]
}

const metrics = [
  ['closingBalanceCents', 'Ending balance (nominal)'],
  ['realClosingBalanceCents', "Ending balance (today's dollars)"],
  ['contributionsCents', 'Total contributed'],
  ['requestedWithdrawalsCents', 'Total requested withdrawals'],
  ['withdrawalsCents', 'Total funded withdrawals'],
  ['shortfallCents', 'Total withdrawal shortfall'],
  ['growthCents', 'Modeled investment growth (nominal)'],
  ['realGrowthCents', "Modeled investment growth (today's dollars)"],
  ['fundFeesCents', 'Additional modeled fund deductions'],
  ['advisoryFeesCents', 'Modeled additional fees'],
] satisfies (readonly [keyof LedgerAmounts, string])[]

export function buildSummaryRows(results: ScenarioPair): TableRowView[] {
  const [a, b] = results
  const rows = metrics.map(([key, label]) => ({
    id: key,
    cells: [
      label,
      formatMoney(a.projection.totals[key]),
      formatMoney(b.projection.totals[key]),
      ...formatDifference(a.projection.totals[key], b.projection.totals[key]),
    ],
  }))
  return [
    ...rows,
    {
      id: 'first-shortfall',
      cells: [
        'First shortfall',
        ...results.map(({ projection }) =>
          projection.firstShortfallMonth === null
            ? 'None in this projection'
            : `Month ${projection.firstShortfallMonth}`,
        ),
        'N/A',
        'N/A',
      ],
    },
  ]
}

function trendValues(
  projection: GrowthProjection,
  metric: ChartMetric,
  basis: DollarBasis,
) {
  let cumulative = 0
  return [
    {
      month: 0,
      cents:
        metric === 'closing' ? projection.assumptions.startingBalanceCents : 0,
    },
    ...projection.monthly.map((row) => {
      cumulative += basis === 'today' ? row.realGrowthCents : row.growthCents
      return {
        month: row.month,
        cents:
          metric === 'growth'
            ? cumulative
            : basis === 'today'
              ? row.realClosingBalanceCents
              : row.closingBalanceCents,
      }
    }),
  ]
}

export function buildChartData(
  results: ScenarioPair,
  metric: ChartMetric,
  basis: DollarBasis,
) {
  if (
    results[0].projection.assumptions.months !==
    results[1].projection.assumptions.months
  ) {
    throw new Error(
      'Scenario comparisons require matching projection horizons.',
    )
  }
  const values = results.map(({ projection }) =>
    trendValues(projection, metric, basis),
  )
  const first = values[0]
  if (!first) throw new Error('A comparison requires a baseline scenario.')
  return {
    series: results.map(({ id, label }, index) => {
      const points = values[index]
      if (!points) throw new Error('A scenario is missing its trend values.')
      return {
        id,
        label,
        points: points.map(({ month, cents }) => ({
          x: month,
          y: cents / 100,
        })),
      }
    }),
    columns: ['Projection month', ...results.map(({ label }) => label)],
    rows: first.map(({ month }, index) => ({
      id: String(month),
      cells: [
        month === 0 ? 'Start (month 0)' : `Month ${month}`,
        ...values.map((points) => {
          const point = points[index]
          if (!point || point.month !== month)
            throw new Error('Comparison points must align by projection month.')
          return formatMoney(point.cents)
        }),
      ],
    })),
  }
}

interface LedgerColumn {
  key: keyof LedgerAmounts
  label: string
  group?: keyof LedgerVisibility
}

const ledgerDefinitions: readonly LedgerColumn[] = [
  { key: 'openingBalanceCents', label: 'Opening', group: 'cashFlows' },
  { key: 'contributionsCents', label: 'Contributed', group: 'cashFlows' },
  { key: 'requestedWithdrawalsCents', label: 'Requested', group: 'cashFlows' },
  { key: 'withdrawalsCents', label: 'Withdrawn', group: 'cashFlows' },
  { key: 'shortfallCents', label: 'Shortfall', group: 'cashFlows' },
  { key: 'growthCents', label: 'Growth (nominal)' },
  { key: 'fundFeesCents', label: 'Fund deductions', group: 'fees' },
  { key: 'advisoryFeesCents', label: 'Additional fees', group: 'fees' },
  { key: 'closingBalanceCents', label: 'Closing (nominal)' },
  {
    key: 'realGrowthCents',
    label: "Growth (today's dollars)",
    group: 'todaysDollars',
  },
  {
    key: 'realClosingBalanceCents',
    label: "Closing (today's dollars)",
    group: 'todaysDollars',
  },
]

export function buildLedger(
  projection: GrowthProjection,
  mode: LedgerMode,
  year: number,
  visibility: LedgerVisibility,
) {
  if (
    mode === 'monthly' &&
    projection.monthly.length > 0 &&
    (!Number.isInteger(year) || year < 1 || year > projection.annual.length)
  ) {
    throw new Error('Choose an available whole projection year.')
  }
  const columns = ledgerDefinitions.filter(
    ({ group }) => !group || visibility[group],
  )
  function cells(label: string, row: LedgerAmounts) {
    return [label, ...columns.map(({ key }) => formatMoney(row[key]))]
  }
  return {
    columns: ['Period', ...columns.map(({ label }) => label)],
    rows:
      mode === 'annual'
        ? projection.annual.map((row) => ({
            id: String(row.year),
            cells: cells(
              `Year ${row.year} (months ${row.startMonth}-${row.endMonth})`,
              row,
            ),
          }))
        : projection.monthly
            .filter((row) => Math.ceil(row.month / 12) === year)
            .map((row) => ({
              id: String(row.month),
              cells: cells(`Month ${row.month}`, row),
            })),
  }
}
