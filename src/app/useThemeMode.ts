import { useState, useSyncExternalStore } from 'react'
import type { ResolvedTheme, ThemeMode } from '@ui'

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getInitialMode(): ThemeMode {
  const requested = new URLSearchParams(window.location.search).get(
    'clawpilotTheme',
  )
  return requested === 'light' || requested === 'dark' ? requested : 'system'
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode)
  const prefersDark = useSyncExternalStore(subscribe, getSnapshot)
  const theme: ResolvedTheme =
    mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
  return { mode, setMode, theme }
}
