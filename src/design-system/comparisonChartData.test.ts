import { describe, expect, it, vi } from 'vitest'
import { tokens } from '@fluentui/react-components'
import { prepareComparisonChart } from './comparisonChartData'
import type { ComparisonChartProps } from './ComparisonChart.types'

function propsFor(values: readonly number[]): ComparisonChartProps {
  return {
    title: 'Comparison',
    xLabel: 'Month',
    yLabel: 'Value',
    formatValue: (value) => `$${value.toFixed(2)}`,
    series: [
      {
        id: 'a',
        label: 'Scenario A',
        points: values.map((y, x) => ({ x, y })),
      },
      {
        id: 'b',
        label: 'Scenario B',
        points: values.map((y, x) => ({ x, y })),
      },
    ],
  }
}

describe('comparison chart presentation data', () => {
  it('routes singleton series to the keyed point renderer without adding synthetic points', () => {
    const chart = prepareComparisonChart(propsFor([0]))
    expect(chart.hasSingletonSeries).toBe(true)
    expect(
      chart.data.lineChartData.map((line) =>
        line.data.map(({ x, y }) => ({ x, y })),
      ),
    ).toEqual([[{ x: 0, y: 0 }], [{ x: 0, y: 0 }]])
    expect(chart.tickValues).toEqual([0])
    expect(chart.yMinValue).toBe(-1)
    expect(chart.yMaxValue).toBe(1)
    expect(prepareComparisonChart(propsFor([0, 1])).hasSingletonSeries).toBe(
      false,
    )
  })

  it('handles a singleton beside a multi-point series without dropping either', () => {
    const props = propsFor([0, 1])
    const chart = prepareComparisonChart({
      ...props,
      series: props.series.map((series, index) => ({
        ...series,
        points: index === 0 ? [{ x: 0, y: 0 }] : series.points,
      })),
    })
    expect(chart.hasSingletonSeries).toBe(true)
    expect(chart.data.lineChartData.map((line) => line.data.length)).toEqual([
      1, 2,
    ])
  })

  it.each([
    [0],
    [0, 0, 0],
    [100, 100],
    [-100, -100],
    [-100, -50],
    [-50, 50],
    [0, 0.001],
  ])('provides finite, nondegenerate axes for %j', (...values) => {
    const chart = prepareComparisonChart(propsFor(values))
    expect(Number.isFinite(chart.yMinValue)).toBe(true)
    expect(Number.isFinite(chart.yMaxValue)).toBe(true)
    expect(chart.yMinValue).toBeLessThan(Math.min(...values))
    expect(chart.yMaxValue).toBeGreaterThan(Math.max(...values))
    expect(chart.xMaxValue).toBeGreaterThan(chart.xMinValue)
    if (values.length === 1) expect(chart.tickValues).toEqual([0])
  })

  it('keeps both scenarios, exact coordinates, callouts, and distinct strokes', () => {
    const props = propsFor([0, -1, 1200])
    const formatValue = vi.fn(props.formatValue)
    const chart = prepareComparisonChart({ ...props, formatValue })
    const lines = chart.data.lineChartData
    expect(lines).toHaveLength(2)
    expect(lines?.map((line) => line.legend)).toEqual([
      'Scenario A',
      'Scenario B',
    ])
    expect(lines?.map((line) => line.color)).toEqual([
      tokens.colorBrandForeground1,
      tokens.colorNeutralForeground2,
    ])
    expect(lines?.[0]?.lineOptions?.strokeDasharray).not.toBe(
      lines?.[1]?.lineOptions?.strokeDasharray,
    )
    expect(lines?.[0]?.data.map(({ x, y }) => ({ x, y }))).toEqual(
      props.series[0]?.points,
    )
    expect(lines?.[0]?.data[1]).toMatchObject({
      x: 1,
      y: -1,
      xAxisCalloutData: 'Month: 1',
      yAxisCalloutData: '$-1.00',
      callOutAccessibilityData: {
        ariaLabel: 'Scenario A. Month: 1. Value: $-1.00.',
      },
    })
    expect(formatValue).toHaveBeenCalledTimes(6)
  })

  it('retains all 1,201 monthly coordinates without sampling', () => {
    const props = propsFor(Array.from({ length: 1201 }, (_, index) => index))
    const chart = prepareComparisonChart(props)
    expect(chart.data.lineChartData?.[0]?.data).toHaveLength(1201)
    expect(chart.xMaxValue).toBe(1200)
    expect(chart.tickValues).toEqual([0, 600, 1200])
  })

  it('keeps short projection axes on integer months without duplicate ticks', () => {
    expect(prepareComparisonChart(propsFor([0, 1])).tickValues).toEqual([0, 1])
    expect(prepareComparisonChart(propsFor([0, 1, 2])).tickValues).toEqual([
      0, 1, 2,
    ])
  })

  it('reports empty, nonfinite, unordered, and ambiguous data explicitly', () => {
    expect(() =>
      prepareComparisonChart({ ...propsFor([0]), series: [] }),
    ).toThrow(/at least one/)
    expect(() => prepareComparisonChart(propsFor([]))).toThrow(/no points/)
    expect(() => prepareComparisonChart(propsFor([NaN]))).toThrow(/finite/)
    expect(() => prepareComparisonChart(propsFor([Infinity]))).toThrow(/finite/)
    for (const points of [
      [{ x: -1, y: 0 }],
      [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    ]) {
      expect(() =>
        prepareComparisonChart({
          ...propsFor([0]),
          series: [{ id: 'a', label: 'A', points }],
        }),
      ).toThrow(/coordinates/)
    }
    expect(() =>
      prepareComparisonChart({
        ...propsFor([0]),
        series: [
          { id: 'a', label: 'Same', points: [{ x: 0, y: 0 }] },
          { id: 'b', label: 'Same', points: [{ x: 0, y: 0 }] },
        ],
      }),
    ).toThrow(/unique/)
  })
})
