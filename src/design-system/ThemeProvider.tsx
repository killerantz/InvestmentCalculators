import { useLayoutEffect, type ReactNode } from 'react'
import { FluentProvider, makeStyles, tokens } from '@fluentui/react-components'
import { themes } from './theme/themes'
import { appTokens, type ResolvedTheme } from './theme/tokens'

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground1,
  },
  // Provider classes also reach portals; viewport layout must stay on a child.
  viewport: {
    minHeight: appTokens.viewportHeight,
  },
})

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ResolvedTheme
  children: ReactNode
}) {
  const styles = useStyles()
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <FluentProvider theme={themes[theme]} className={styles.root}>
      <div className={styles.viewport}>{children}</div>
    </FluentProvider>
  )
}
