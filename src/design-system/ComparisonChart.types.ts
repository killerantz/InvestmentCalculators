export type ComparisonChartProps = {
  title: string
  xLabel: string
  yLabel: string
  series: readonly {
    id: string
    label: string
    styleIndex?: number
    points: readonly { x: number; y: number }[]
  }[]
  formatValue: (value: number) => string
  formatXValue?: (value: number) => string
  markerLabel?: string
  markers?: readonly {
    id: string
    x: number
    label: string
    detail: string
  }[]
}
