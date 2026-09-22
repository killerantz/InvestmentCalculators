import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChartErrorBoundary } from './ChartErrorBoundary'
import { Notice } from './Notice'

describe('chart-only error boundary', () => {
  it('preserves children when the chart succeeds', () => {
    const child = createElement('span', null, 'Chart')
    const boundary = new ChartErrorBoundary({ children: child })
    expect(boundary.render()).toBe(child)
  })

  it('renders an explicit alert after a load or render failure', () => {
    const boundary = new ChartErrorBoundary({ children: 'Chart' })
    boundary.state = ChartErrorBoundary.getDerivedStateFromError()
    expect(boundary.render()).toEqual(
      createElement(Notice, {
        tone: 'error',
        children:
          'Unable to display the comparison chart. You can continue using the accompanying data table for exact values.',
      }),
    )
  })

  it('logs the actual failure and component context', () => {
    const error = new Error('Chart chunk request failed')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const boundary = new ChartErrorBoundary({ children: 'Chart' })
      boundary.componentDidCatch(error, {
        componentStack: 'ComparisonChartPlot',
      })
      expect(log).toHaveBeenCalledWith(
        'Comparison chart failed to load or render.',
        error,
        'ComparisonChartPlot',
      )
    } finally {
      log.mockRestore()
    }
  })
})
