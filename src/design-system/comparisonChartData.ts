import { tokens } from '@fluentui/react-components'
import type { ChartProps, LineChartPoints } from '@fluentui/react-charts'
import type { ComparisonChartProps } from './ComparisonChart.types'
import { appTokens } from './theme/tokens'

export function prepareComparisonChart({
  title,
  xLabel,
  yLabel,
  series,
  formatValue,
}: ComparisonChartProps) {
  const ids = new Set<string>()
  const labels = new Set<string>()
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity

  const lines = series.map((item, index) => {
    if (!item.id || ids.has(item.id) || !item.label || labels.has(item.label)) {
      throw new Error(
        'ComparisonChart series must have unique, nonempty ids and labels.',
      )
    }
    ids.add(item.id)
    labels.add(item.label)
    if (!item.points.length) {
      throw new Error(`ComparisonChart series "${item.id}" has no points.`)
    }
    let previousX = -Infinity
    const data = item.points.map(({ x, y }) => {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        x <= previousX
      ) {
        throw new Error(
          `ComparisonChart series "${item.id}" requires finite values and strictly increasing, nonnegative x coordinates.`,
        )
      }
      previousX = x
      xMin = Math.min(xMin, x)
      xMax = Math.max(xMax, x)
      yMin = Math.min(yMin, y)
      yMax = Math.max(yMax, y)
      const formatted = formatValue(y)
      return {
        x,
        y,
        xAxisCalloutData: `${xLabel}: ${x}`,
        yAxisCalloutData: formatted,
        callOutAccessibilityData: {
          ariaLabel: `${item.label}. ${xLabel}: ${x}. ${yLabel}: ${formatted}.`,
        },
      }
    })
    return {
      legend: item.label,
      data,
      color:
        index % 2 === 0
          ? tokens.colorBrandForeground1
          : tokens.colorNeutralForeground2,
      lineOptions: {
        strokeWidth: appTokens.chartLineWidth,
        strokeDasharray:
          index % 2 === 0
            ? appTokens.chartSolidLine
            : appTokens.chartDashedLine,
      },
    } satisfies LineChartPoints
  })

  if (!lines.length) {
    throw new Error('ComparisonChart requires at least one series.')
  }
  const padding = Math.max(
    (yMin === yMax ? Math.abs(yMin) : yMax - yMin) * 0.05,
    1,
  )
  const yMinValue = yMin - padding
  const yMaxValue = yMax + padding
  if (!Number.isFinite(yMinValue) || !Number.isFinite(yMaxValue)) {
    throw new Error('ComparisonChart values exceed the supported axis range.')
  }

  const data = {
    chartTitle: title,
    lineChartData: lines,
    chartDataAccessibilityData: {
      ariaLabel: `${title}. ${series.map((item) => item.label).join(' and ')}. ${xLabel} by ${yLabel}.`,
    },
  } satisfies ChartProps

  const midpoint =
    Number.isInteger(xMin) && Number.isInteger(xMax)
      ? Math.floor(xMin + (xMax - xMin) / 2)
      : xMin + (xMax - xMin) / 2

  return {
    hasSingletonSeries: lines.some((line) => line.data.length === 1),
    data,
    xMinValue: xMin === xMax ? Math.max(0, xMin - 1) : xMin,
    xMaxValue: xMin === xMax ? xMax + 1 : xMax,
    tickValues: [...new Set([xMin, midpoint, xMax])],
    yMinValue,
    yMaxValue,
  }
}
