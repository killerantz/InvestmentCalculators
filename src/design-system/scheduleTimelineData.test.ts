import { describe, expect, it } from 'vitest'
import { prepareTimeline } from './scheduleTimelineData'
import { appTokens } from './theme/tokens'

const item = (id: string, start: number, end: number) => ({
  id,
  start,
  end,
  label: id,
  detail: '',
})
describe('schedule timeline geometry', () => {
  it('preserves exact proportional duration and boundaries', () => {
    const segments = prepareTimeline({
      total: 480,
      items: [
        item('first', 0, 120),
        item('second', 120, 240),
        item('third', 240, 480),
      ],
    })
    const width = appTokens.timelineWidth - 2 * appTokens.timelinePadding
    expect(segments.map((segment) => segment.width)).toEqual([
      width / 4,
      width / 4,
      width / 2,
    ])
    expect(segments[0]?.x).toBe(appTokens.timelinePadding)
    expect(segments[2]!.x + segments[2]!.width).toBe(
      appTokens.timelineWidth - appTokens.timelinePadding,
    )
  })
  it('keeps one-month segments distinct without widening them artificially', () => {
    const [segment] = prepareTimeline({
      total: 1200,
      items: [item('short', 0, 1)],
    })
    expect(segment!.width).toBe(
      (appTokens.timelineWidth - 2 * appTokens.timelinePadding) / 1200,
    )
  })
  it.each([
    { total: 0, items: [item('a', 0, 1)] },
    { total: 12, items: [] },
    { total: 12, items: [item('a', 0, 0)] },
    { total: 12, items: [item('a', 0, 13)] },
    { total: 12, items: [item('a', 0, 6), item('b', 5, 12)] },
    { total: 12, items: [item('a', 0, 6), item('a', 6, 12)] },
    { total: 12, items: [item('a', 0.5, 6)] },
  ])('rejects invalid duration or interval data', (props) => {
    expect(() => prepareTimeline(props)).toThrow(/whole-month/)
  })
})
