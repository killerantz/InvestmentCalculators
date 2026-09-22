export const appTokens = {
  contentWidth: '72rem',
  cardMinWidth: '24rem',
  iconSize: '24px',
  viewportHeight: '100dvh',
  yearInputWidth: '5rem',
  chartHeight: '22.5rem',
  chartLineWidth: 2,
  chartSolidLine: '0',
  chartDashedLine: '6 4',
  chartPointPlotHeight: 280,
  chartMinimumPlotWidth: 140,
  chartPlotTop: 20,
  chartPlotRight: 20,
  chartPlotBottom: 48,
  chartAxisLabelSpace: 44,
  chartLabelCharacterWidth: 7,
  chartTickLabelGap: 10,
  chartTickLabelSpace: 20,
  chartPointRadius: 4,
  chartPointSquareSize: 12,
} as const

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = Exclude<ThemeMode, 'system'>
