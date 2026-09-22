import { useMemo, useState } from 'react'
import type { ValidationIssue } from '../../../domain/growth'
import {
  choiceFields,
  evaluateScenario,
  exampleScenarios,
  numericFields,
  type ScenarioValues,
} from './worksheet'
import {
  buildChartData,
  buildLedger,
  buildSummaryRows,
  chartMetricOptions,
  dollarBasisOptions,
  formatChartValue,
  formatInflation,
  ledgerModeOptions,
  ledgerVisibilityOptions,
  selectedOption,
  type ChartMetric,
  type DollarBasis,
  type LedgerMode,
  type LedgerVisibility,
  type ScenarioPair,
  type ScenarioResult,
} from './comparisonView'

export function useGrowthPlanner() {
  const [drafts, setDrafts] = useState(exampleScenarios)
  const [months, setMonths] = useState('120')
  const [errors, setErrors] = useState<
    Record<string, readonly ValidationIssue[]>
  >({})
  const [results, setResults] = useState<ScenarioPair | null>(null)
  const [selectedYear, setSelectedYear] = useState(1)
  const [ledgerMode, setLedgerMode] = useState<LedgerMode>('annual')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('closing')
  const [dollarBasis, setDollarBasis] = useState<DollarBasis>('nominal')
  const [showChartData, setShowChartData] = useState(false)
  const [visibility, setVisibility] = useState<LedgerVisibility>({
    cashFlows: false,
    fees: false,
    todaysDollars: false,
  })
  const [status, setStatus] = useState(
    'Synthetic examples only. Edit the assumptions, then compare scenarios. Nothing is saved or sent to an AI service.',
  )

  function invalidate() {
    setResults(null)
    setStatus(
      'Inputs changed. Compare again to calculate results for the current assumptions.',
    )
  }

  function changeScenario(
    id: string,
    field: keyof ScenarioValues,
    value: string,
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? { ...draft, values: { ...draft.values, [field]: value } }
          : draft,
      ),
    )
    setErrors((current) => ({
      ...current,
      [id]: (current[id] ?? []).filter((error) => error.field !== field),
    }))
    invalidate()
  }

  function changeMonths(value: string) {
    setMonths(value)
    setErrors({})
    invalidate()
  }

  function compare() {
    const nextErrors: Record<string, readonly ValidationIssue[]> = {}
    const nextResults: ScenarioResult[] = []
    for (const draft of drafts) {
      const outcome = evaluateScenario(draft.values, months)
      if (outcome.ok)
        nextResults.push({
          id: draft.id,
          label: draft.label,
          projection: outcome.projection,
        })
      else nextErrors[draft.id] = outcome.errors
    }
    setErrors(nextErrors)
    setSelectedYear(1)
    if (Object.keys(nextErrors).length) {
      setResults(null)
      setStatus(
        'Correct the reported inputs and compare again. No projection was substituted for an invalid scenario.',
      )
    } else {
      const [baseline, alternative] = nextResults
      if (!baseline || !alternative || nextResults.length !== 2)
        throw new Error('The worksheet requires exactly two scenarios.')
      setResults([baseline, alternative])
      setStatus(
        'Comparison calculated. Results reflect only these assumptions, not predictions or a recommendation.',
      )
    }
  }

  function changeYear(year: number) {
    const yearCount = results?.[0]?.projection.annual.length ?? 0
    if (!Number.isInteger(year) || year < 1 || year > yearCount) {
      setStatus('Choose an available whole projection year.')
      return
    }
    setSelectedYear(year)
  }

  function changeVisibility(key: keyof LedgerVisibility, checked: boolean) {
    setVisibility((current) => ({ ...current, [key]: checked }))
  }

  const summaryRows = useMemo(
    () => (results ? buildSummaryRows(results) : []),
    [results],
  )
  const chart = useMemo(
    () => (results ? buildChartData(results, chartMetric, dollarBasis) : null),
    [results, chartMetric, dollarBasis],
  )
  const ledgers = useMemo(
    () =>
      (results ?? []).map(({ id, label, projection }) => ({
        id,
        label,
        feeNote:
          projection.assumptions.returnBasis === 'after-fund-expenses'
            ? 'Fund expenses are already reflected in the return assumption. Zero extra fund deductions does not mean zero fund costs.'
            : 'Fund expenses are deducted separately from the before-expense return assumption.',
        ...buildLedger(projection, ledgerMode, selectedYear, visibility),
      })),
    [results, ledgerMode, selectedYear, visibility],
  )
  const metricLabel =
    chartMetric === 'closing'
      ? 'Closing balance'
      : 'Cumulative investment growth'
  const basisLabel =
    dollarBasis === 'nominal' ? 'nominal dollars' : "today's dollars"

  return {
    months,
    changeMonths,
    monthError:
      Object.values(errors)
        .flat()
        .find((issue) => issue.field === 'months')?.message ?? '',
    scenarios: drafts.map((draft) => ({
      id: draft.id,
      label: draft.label,
      fields: numericFields.map((field) => ({
        ...field,
        value: draft.values[field.key],
        error:
          errors[draft.id]?.find((error) => error.field === field.key)
            ?.message ?? '',
      })),
      choices: choiceFields.map((field) => ({
        ...field,
        value: draft.values[field.key],
      })),
    })),
    changeScenario,
    compare,
    status,
    hasErrors: Object.values(errors).some((issues) => issues.length > 0),
    errorMessages: drafts.flatMap((draft) =>
      (errors[draft.id] ?? []).map(
        (error) => `${draft.label}: ${error.message}`,
      ),
    ),
    hasResults: results !== null,
    summaryColumns: [
      'Measure',
      ...(results ?? []).map((result) => result.label),
      'Difference (B - A)',
      'Difference % (vs A)',
    ],
    summaryRows,
    chart,
    chartTitle: `${metricLabel}: ${basisLabel}`,
    chartYLabel: `${metricLabel} (${basisLabel}, USD)`,
    chartMetric,
    chartMetricOptions,
    changeChartMetric: (value: string) =>
      setChartMetric(selectedOption(chartMetricOptions, value)),
    dollarBasis,
    dollarBasisOptions,
    changeDollarBasis: (value: string) =>
      setDollarBasis(selectedOption(dollarBasisOptions, value)),
    formatChartValue,
    showChartData,
    changeShowChartData: setShowChartData,
    inflationNotes: (results ?? []).map(
      ({ label, projection }) =>
        `${label}: ${formatInflation(projection.assumptions.annualInflationRate)} annual inflation assumption.`,
    ),
    ledgerMode,
    ledgerModeOptions,
    changeLedgerMode: (value: string) =>
      setLedgerMode(selectedOption(ledgerModeOptions, value)),
    selectedYear,
    changeYear,
    yearCount: results?.[0]?.projection.annual.length ?? 0,
    visibilityOptions: ledgerVisibilityOptions.map((option) => ({
      ...option,
      checked: visibility[option.key],
    })),
    changeVisibility,
    ledgers,
  }
}

export type GrowthPlannerModel = ReturnType<typeof useGrowthPlanner>
