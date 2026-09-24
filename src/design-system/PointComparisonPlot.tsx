import { Legends } from '@fluentui/react-charts'
import { Tooltip, makeStyles, tokens } from '@fluentui/react-components'
import type { ComparisonChartProps } from './ComparisonChart.types'
import type { prepareComparisonChart } from './comparisonChartData'
import { appTokens } from './theme/tokens'
import { Text } from './typography'

const useStyles = makeStyles({
  root: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  viewport: {
    minWidth: 0,
    overflowX: 'auto',
  },
  label: {
    fill: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase200,
  },
  grid: {
    stroke: tokens.colorNeutralStroke2,
    strokeWidth: tokens.strokeWidthThin,
  },
})

type PointComparisonPlotProps = Pick<
  ComparisonChartProps,
  'title' | 'xLabel' | 'yLabel' | 'formatValue'
> & {
  chart: ReturnType<typeof prepareComparisonChart>
  width: number
}

// Fluent 9.3.26's single-point branch creates unkeyed fragments. Keep exact
// coordinates here rather than duplicating data to force its line-segment path.
export function PointComparisonPlot({
  title,
  xLabel,
  yLabel,
  formatValue,
  chart,
  width,
}: PointComparisonPlotProps) {
  const styles = useStyles()
  const { data, xMinValue, xMaxValue, yMinValue, yMaxValue, tickValues } = chart
  const yTicks = Array.from(
    { length: 5 },
    (_, index) => yMinValue + ((yMaxValue - yMinValue) * index) / 4,
  )
  const labelWidth =
    Math.max(...yTicks.map((tick) => formatValue(tick).length)) *
    appTokens.chartLabelCharacterWidth
  const left = labelWidth + appTokens.chartAxisLabelSpace
  const top = appTokens.chartPlotTop
  const bottom = appTokens.chartPointPlotHeight - appTokens.chartPlotBottom
  const plotWidth = Math.max(
    width,
    left + appTokens.chartMinimumPlotWidth + appTokens.chartPlotRight,
  )
  const right = plotWidth - appTokens.chartPlotRight
  const scaleX = (x: number) =>
    left + ((x - xMinValue) / (xMaxValue - xMinValue)) * (right - left)
  const scaleY = (y: number) =>
    bottom - ((y - yMinValue) / (yMaxValue - yMinValue)) * (bottom - top)

  return (
    <div className={styles.root}>
      <Text muted>{yLabel}</Text>
      <div
        className={styles.viewport}
        role="region"
        aria-label={`${title} plot`}
        tabIndex={0}
      >
        <svg
          width={plotWidth}
          height={appTokens.chartPointPlotHeight}
          role="group"
          aria-label={`${title}. ${data.lineChartData.map((line) => line.legend).join(' and ')}. ${xLabel} by ${yLabel}.`}
        >
          {yTicks.map((tick) => (
            <g key={tick} aria-hidden="true">
              <line
                className={styles.grid}
                x1={left}
                x2={right}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
              />
              <text
                className={styles.label}
                x={left - appTokens.chartTickLabelGap}
                y={scaleY(tick)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}
          {tickValues.map((tick) => (
            <text
              key={tick}
              className={styles.label}
              x={scaleX(tick)}
              y={bottom + appTokens.chartTickLabelSpace}
              textAnchor="middle"
              aria-hidden="true"
            >
              {tick}
            </text>
          ))}
          {chart.markers.map((marker) => (
            <g
              key={marker.id}
              role="img"
              aria-label={`${marker.number}. ${marker.label}. ${marker.detail}`}
            >
              <title>
                {marker.label}. {marker.detail}
              </title>
              <line
                className={styles.grid}
                x1={scaleX(marker.x)}
                x2={scaleX(marker.x)}
                y1={bottom - appTokens.chartMarkerOffset}
                y2={bottom}
                strokeDasharray={appTokens.chartDashedLine}
              />
              <text
                className={styles.label}
                x={scaleX(marker.x)}
                y={bottom - appTokens.chartMarkerOffset}
                textAnchor={marker.x === xMinValue ? 'start' : 'middle'}
              >
                {marker.number}
              </text>
            </g>
          ))}
          {data.lineChartData.map((line, index) => (
            <g key={line.legend}>
              {line.data.length > 1 && (
                <path
                  d={line.data
                    .map(
                      (point, pointIndex) =>
                        `${pointIndex ? 'L' : 'M'}${scaleX(point.x)},${scaleY(point.y)}`,
                    )
                    .join(' ')}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={line.lineOptions.strokeWidth}
                  strokeDasharray={line.lineOptions.strokeDasharray}
                  aria-hidden="true"
                />
              )}
              {line.data.map((point) => (
                <Tooltip
                  key={point.x}
                  content={point.callOutAccessibilityData.ariaLabel}
                  relationship="description"
                >
                  <g
                    role="img"
                    aria-label={point.callOutAccessibilityData.ariaLabel}
                    tabIndex={0}
                  >
                    {index % 2 === 0 ? (
                      <circle
                        cx={scaleX(point.x)}
                        cy={scaleY(point.y)}
                        r={appTokens.chartPointRadius}
                        fill={line.color}
                      />
                    ) : (
                      <rect
                        x={scaleX(point.x) - appTokens.chartPointSquareSize / 2}
                        y={scaleY(point.y) - appTokens.chartPointSquareSize / 2}
                        width={appTokens.chartPointSquareSize}
                        height={appTokens.chartPointSquareSize}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={appTokens.chartLineWidth}
                      />
                    )}
                  </g>
                </Tooltip>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <Text muted>{xLabel}</Text>
      <Legends
        allowFocusOnLegends={false}
        enabledWrapLines
        legends={data.lineChartData.map((line, index) => ({
          title: line.legend,
          color: line.color,
          shape: index % 2 === 0 ? 'circle' : 'square',
        }))}
      />
    </div>
  )
}
