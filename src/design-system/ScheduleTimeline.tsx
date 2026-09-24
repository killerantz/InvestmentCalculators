import { useId } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import { appTokens } from './theme/tokens'
import { Stack } from './layout'
import { Text } from './typography'
import { prepareTimeline } from './scheduleTimelineData'

const useStyles = makeStyles({
  scroll: { minWidth: 0, overflowX: 'auto' },
  chart: {
    width: '100%',
    minWidth: appTokens.timelineMinWidth,
    height: appTokens.timelineHeight,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
  },
  brand: { fill: tokens.colorBrandBackground },
  neutral: { fill: tokens.colorNeutralForeground2 },
  brandText: { fill: tokens.colorNeutralForegroundOnBrand },
  neutralText: { fill: tokens.colorNeutralBackground1 },
  axis: { fill: tokens.colorNeutralForeground1 },
})

export type ScheduleTimelineProps = {
  label: string
  showLegend?: boolean
  startLabel?: string
  endLabel?: string
  total: number
  items: readonly {
    id: string
    label: string
    start: number
    end: number
    detail: string
  }[]
}

export function ScheduleTimeline({
  label,
  total,
  items,
  showLegend = true,
  startLabel = 'Month 0',
  endLabel = `Month ${total}`,
}: ScheduleTimelineProps) {
  const styles = useStyles()
  const id = useId()
  const segments = prepareTimeline({ total, items })
  return (
    <Stack>
      <div
        className={styles.scroll}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <svg
          className={styles.chart}
          viewBox={`0 0 ${appTokens.timelineWidth} ${appTokens.timelineViewHeight}`}
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <title id={`${id}-title`}>{label}</title>
          <desc id={`${id}-description`}>
            Phase durations on the planning timeline, not projected balances.
            Each numbered segment identifies a phase in the accompanying
            details.
          </desc>
          {segments.map((item, index) => {
            const { x, width: segmentWidth } = item
            return (
              <g key={item.id}>
                <title>
                  {item.label}: {item.detail}
                </title>
                <rect
                  x={x}
                  y={appTokens.timelineBandY}
                  width={segmentWidth}
                  height={appTokens.timelineBandHeight}
                  className={index % 2 === 0 ? styles.brand : styles.neutral}
                />
                {segmentWidth >= appTokens.timelineMinimumLabelWidth && (
                  <text
                    x={x + segmentWidth / 2}
                    y={appTokens.timelineTextY}
                    textAnchor="middle"
                    className={
                      index % 2 === 0 ? styles.brandText : styles.neutralText
                    }
                  >
                    {index + 1}
                  </text>
                )}
              </g>
            )
          })}
          <text
            x={appTokens.timelinePadding}
            y={appTokens.timelineTickY}
            className={styles.axis}
          >
            {startLabel}
          </text>
          <text
            x={appTokens.timelineWidth - appTokens.timelinePadding}
            y={appTokens.timelineTickY}
            textAnchor="end"
            className={styles.axis}
          >
            {endLabel}
          </text>
        </svg>
      </div>
      {showLegend &&
        items.map((item, index) => (
          <Text key={item.id}>
            {index + 1}. {item.label}: {item.detail}
          </Text>
        ))}
    </Stack>
  )
}
