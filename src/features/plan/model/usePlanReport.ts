import { useState } from 'react'
import type { PlanProjection } from '../../../domain/plan'
import type { PlanDraft } from './draft'
import {
  formatChartMoney,
  planReportView,
  type ReportOptions,
} from './planReportView'

export function usePlanReport(
  projection: PlanProjection | null,
  draft: PlanDraft | undefined,
) {
  const [interval, setInterval] = useState<ReportOptions['interval']>('annual')
  const [year, setYear] = useState(1)
  const [hiddenSeries, setHiddenSeries] = useState<readonly string[]>([])
  const [timeUnit, setTimeUnit] = useState<ReportOptions['timeUnit']>('years')
  const [metric, setMetric] = useState<ReportOptions['metric']>('closing')
  const [basis, setBasis] = useState<ReportOptions['basis']>('nominal')
  const [realColumns, setRealColumns] = useState(false)
  if (!projection || !draft) return null
  const yearCount = projection.annual.length
  const selectedYear = Math.min(year, yearCount)
  const view = planReportView(projection, draft, {
    interval,
    year: selectedYear,
    hiddenSeries,
    timeUnit,
    metric,
    basis,
    realColumns,
  })
  return {
    ...view,
    yearCount,
    year: selectedYear,
    setYear,
    interval,
    metric,
    basis,
    realColumns,
    setRealColumns,
    setSeriesVisible: (id: string, visible: boolean) => {
      if (!view.seriesOptions.some((item) => item.id === id))
        throw new Error('Select a chart line in this projection.')
      setHiddenSeries((current) =>
        visible
          ? current.filter((item) => item !== id)
          : [...new Set([...current, id])],
      )
    },
    timeUnit,
    timeUnitOptions: [
      { value: 'years', label: 'Years' },
      { value: 'months', label: 'Months' },
    ],
    setTimeUnit: (value: string) => {
      if (value !== 'years' && value !== 'months')
        throw new Error('Unsupported chart time unit.')
      setTimeUnit(value)
    },
    intervalOptions: [
      { value: 'annual', label: 'Yearly' },
      { value: 'monthly', label: 'Monthly' },
    ],
    setInterval: (value: string) => {
      if (value !== 'annual' && value !== 'monthly')
        throw new Error('Unsupported ledger interval.')
      setInterval(value)
    },
    metricOptions: [
      { value: 'closing', label: 'Account balance' },
      { value: 'growth', label: 'Growth earned so far' },
    ],
    setMetric: (value: string) => {
      if (value !== 'closing' && value !== 'growth')
        throw new Error('Unsupported chart metric.')
      setMetric(value)
    },
    basisOptions: [
      { value: 'nominal', label: 'Nominal dollars' },
      { value: 'today', label: "Today's dollars" },
    ],
    setBasis: (value: string) => {
      if (value !== 'nominal' && value !== 'today')
        throw new Error('Unsupported dollar basis.')
      setBasis(value)
    },
    formatChartMoney,
  }
}
export type PlanReportModel = NonNullable<ReturnType<typeof usePlanReport>>
