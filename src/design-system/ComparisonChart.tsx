import { lazy, Suspense, useId } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import type { ComparisonChartProps } from './ComparisonChart.types'
import { Heading, Text } from './typography'
import { Notice } from './Notice'
import { ChartErrorBoundary } from './ChartErrorBoundary'

const ComparisonChartPlot = lazy(() => import('./ComparisonChartPlot'))

const useStyles = makeStyles({
  root: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
})

export function ComparisonChart(props: ComparisonChartProps) {
  const styles = useStyles()
  const titleId = useId()
  const descriptionId = useId()
  return (
    <section
      className={styles.root}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <Heading level={2} id={titleId}>
        {props.title}
      </Heading>
      <div id={descriptionId}>
        <Text>
          {props.xLabel} on the horizontal axis; {props.yLabel} on the vertical
          axis. Use the accompanying data table for exact values.
        </Text>
      </div>
      {props.series.length ? (
        <ChartErrorBoundary>
          <Suspense fallback={<Notice>Loading comparison chart...</Notice>}>
            <ComparisonChartPlot {...props} />
          </Suspense>
        </ChartErrorBoundary>
      ) : (
        <Notice>No comparison data available.</Notice>
      )}
      {!!props.markers?.length && (
        <div>
          <Text emphasis>{props.markerLabel ?? 'Timeline markers'}</Text>
          <ol
            aria-label={`${props.title}: ${props.markerLabel ?? 'Timeline markers'}`}
          >
            {props.markers.map((marker) => (
              <li key={marker.id}>
                {marker.label}. {marker.detail}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
