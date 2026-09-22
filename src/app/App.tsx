import { useState } from 'react'
import {
  AppShell,
  Button,
  Row,
  ThemeProvider,
  ThemeSelect,
  ViewPanel,
} from '@ui'
import { FoundationPage } from '@features/foundation'
import { GrowthPlanner } from '@features/growth'
import { useThemeMode } from './useThemeMode'

export function App() {
  const { mode, setMode, theme } = useThemeMode()
  const [filledIcons, setFilledIcons] = useState(false)
  const [showFoundation, setShowFoundation] = useState(false)
  const [previewYear, setPreviewYear] = useState(1)
  return (
    <ThemeProvider theme={theme}>
      <AppShell
        controls={
          <Row>
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
          <FoundationPage
            filledIcons={filledIcons}
            onToggleIcons={() => setFilledIcons((filled) => !filled)}
            onSetFilledIcons={setFilledIcons}
            previewYear={previewYear}
            onPreviewYearChange={setPreviewYear}
            previewActive={showFoundation}
          />
        </ViewPanel>
        <ViewPanel active={!showFoundation}>
          <GrowthPlanner />
        </ViewPanel>
      </AppShell>
    </ThemeProvider>
  )
}
