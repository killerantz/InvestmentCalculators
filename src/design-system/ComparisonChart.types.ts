export type ComparisonChartProps = {
  title: string
  xLabel: string
  yLabel: string
  series: readonly {
    id: string
    label: string
    points: readonly { x: number; y: number }[]
  }[]
  formatValue: (value: number) => string
}
