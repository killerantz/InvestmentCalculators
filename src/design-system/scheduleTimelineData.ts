import { appTokens } from './theme/tokens'
import type { ScheduleTimelineProps } from './ScheduleTimeline'

export function prepareTimeline({
  total,
  items,
}: Pick<ScheduleTimelineProps, 'total' | 'items'>) {
  if (
    !Number.isSafeInteger(total) ||
    total < 1 ||
    items.length === 0 ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.some(
      (item, index) =>
        !Number.isSafeInteger(item.start) ||
        !Number.isSafeInteger(item.end) ||
        item.start < 0 ||
        item.end <= item.start ||
        item.end > total ||
        (index > 0 && item.start < (items[index - 1]?.end ?? 0)),
    )
  ) {
    throw new Error(
      'ScheduleTimeline requires unique, ordered whole-month intervals within its duration.',
    )
  }
  const width = appTokens.timelineWidth - 2 * appTokens.timelinePadding
  return items.map((item) => ({
    ...item,
    x: appTokens.timelinePadding + (item.start / total) * width,
    width: ((item.end - item.start) / total) * width,
  }))
}
