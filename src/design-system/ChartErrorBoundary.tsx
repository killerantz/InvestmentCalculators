import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Notice } from './Notice'

export class ChartErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      'Comparison chart failed to load or render.',
      error,
      info.componentStack,
    )
  }

  render() {
    if (this.state.failed) {
      return (
        <Notice tone="error">
          Unable to display the comparison chart. You can continue using the
          accompanying data table for exact values.
        </Notice>
      )
    }
    return this.props.children
  }
}
