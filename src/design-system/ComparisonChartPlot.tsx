import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart } from '@fluentui/react-charts'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import type { ComparisonChartProps } from './ComparisonChart.types'
import { prepareComparisonChart } from './comparisonChartData'
import { appTokens } from './theme/tokens'
import { PointComparisonPlot } from './PointComparisonPlot'

const useStyles = makeStyles({
  root: {
    minWidth: 0,
    width: '100%',
  },
  lineChart: {
    height: appTokens.chartHeight,
  },
})

export default function ComparisonChartPlot(props: ComparisonChartProps) {
  const styles = useStyles()
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const chart = useMemo(() => prepareComparisonChart(props), [props])
  const { hasSingletonSeries, ...lineChartProps } = chart

  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={container}
      className={mergeClasses(
        styles.root,
        !hasSingletonSeries && styles.lineChart,
      )}
    >
      {width > 0 &&
        (hasSingletonSeries ? (
          <PointComparisonPlot
            title={props.title}
            xLabel={props.xLabel}
            yLabel={props.yLabel}
            formatValue={props.formatValue}
            chart={chart}
            width={width}
          />
        ) : (
          <LineChart
            {...lineChartProps}
            width={width}
            xAxisTitle={props.xLabel}
            yAxisTitle={props.yLabel}
            yAxisTickFormat={props.formatValue}
            yAxisTickCount={4}
            xAxisTickCount={3}
            showYAxisLables
            allowMultipleShapesForPoints
            enabledLegendsWrapLines
            reflowProps={{ mode: 'min-width' }}
            svgProps={{
              'aria-label': `${props.title}. ${props.series.map((item) => item.label).join(' and ')}. ${props.xLabel} by ${props.yLabel}.`,
            }}
          />
        ))}
    </div>
  )
}
