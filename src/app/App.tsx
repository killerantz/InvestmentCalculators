import { useState } from 'react'
import {
  AppShell,
  Button,
  Row,
  Stack,
  ThemeProvider,
  ThemeSelect,
  ViewPanel,
} from '@ui'
import { FoundationPage, ConfirmationPreview } from '@features/foundation'
import { GrowthPlanner } from '@features/growth'
import { PlanEditor } from '@features/plan'
import { PortfolioPlanner } from '@features/portfolio'
import { useThemeMode } from './useThemeMode'

export function App() {
  const { mode, setMode, theme } = useThemeMode()
  const [filledIcons, setFilledIcons] = useState(false)
  const [showFoundation, setShowFoundation] = useState(false)
  const [showPlan, setShowPlan] = useState(true)
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [previewYear, setPreviewYear] = useState(1)
  const [previewText, setPreviewText] = useState('Illustrative label')
  return (
    <ThemeProvider theme={theme}>
      <AppShell
        controls={
          <Row>
            <Button
              aria-pressed={showPlan && !showFoundation && !showPortfolio}
              onClick={() => {
                setShowPlan(true)
                setShowPortfolio(false)
                setShowFoundation(false)
              }}
            >
              Life-phase plan
            </Button>
            <Button
              aria-pressed={!showPlan && !showFoundation && !showPortfolio}
              onClick={() => {
                setShowPlan(false)
                setShowPortfolio(false)
                setShowFoundation(false)
              }}
            >
              Growth comparison
            </Button>
            <Button
              aria-pressed={showPortfolio && !showFoundation}
              onClick={() => {
                setShowPortfolio(true)
                setShowFoundation(false)
              }}
            >
              Portfolio &amp; taxes
            </Button>
            <Button
              aria-pressed={showFoundation}
              onClick={() => setShowFoundation((show) => !show)}
            >
              {showFoundation ? 'Back to worksheets' : 'UI foundations'}
            </Button>
            <ThemeSelect value={mode} onChange={setMode} />
          </Row>
        }
      >
        <ViewPanel active={showFoundation}>
          <Stack>
            <FoundationPage
              filledIcons={filledIcons}
              onToggleIcons={() => setFilledIcons((filled) => !filled)}
              onSetFilledIcons={setFilledIcons}
              previewYear={previewYear}
              onPreviewYearChange={setPreviewYear}
              previewActive={showFoundation}
              previewText={previewText}
              onPreviewTextChange={setPreviewText}
            />
            <ConfirmationPreview />
          </Stack>
        </ViewPanel>
        <ViewPanel active={!showFoundation && showPlan && !showPortfolio}>
          <PlanEditor />
        </ViewPanel>
        <ViewPanel active={!showFoundation && !showPlan && !showPortfolio}>
          <GrowthPlanner />
        </ViewPanel>
        <ViewPanel active={!showFoundation && showPortfolio}>
          <PortfolioPlanner />
        </ViewPanel>
      </AppShell>
    </ThemeProvider>
  )
}
