import { useId, type ReactNode } from 'react'
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { appTokens } from './theme/tokens'
import { Icon, type IconName } from './Icon'
import { Heading, Text } from './typography'

const useStyles = makeStyles({
  container: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: appTokens.contentWidth,
    marginInline: 'auto',
    paddingInline: tokens.spacingHorizontalXL,
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    paddingBlock: tokens.spacingVerticalL,
  },
  main: {
    paddingBlock: tokens.spacingVerticalXXXL,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    minWidth: 0,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
  },
  between: {
    justifyContent: 'space-between',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${appTokens.cardMinWidth}), 1fr))`,
    gap: tokens.spacingHorizontalXL,
  },
  panel: {
    padding: tokens.spacingHorizontalXXL,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTopWidth: tokens.strokeWidthThin,
    borderRightWidth: tokens.strokeWidthThin,
    borderBottomWidth: tokens.strokeWidthThin,
    borderLeftWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    boxShadow: tokens.shadow4,
    minWidth: 0,
  },
  footer: {
    paddingBlock: tokens.spacingVerticalXL,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
  },
  skip: {
    position: 'absolute',
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForegroundLink,
    transform: 'translateY(-100%)',
    ':focus': {
      transform: 'none',
    },
  },
})

export function Stack({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <div className={styles.stack}>{children}</div>
}

export function ViewPanel({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return <div hidden={!active}>{children}</div>
}

export function Row({
  children,
  spread = false,
}: {
  children: ReactNode
  spread?: boolean
}) {
  const styles = useStyles()
  return (
    <div className={mergeClasses(styles.row, spread && styles.between)}>
      {children}
    </div>
  )
}

export function Grid({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <div className={styles.grid}>{children}</div>
}

export function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon: IconName
  children: ReactNode
}) {
  const styles = useStyles()
  const titleId = useId()
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <Stack>
        <Row>
          <Icon name={icon} />
          <Heading level={2} id={titleId}>
            {title}
          </Heading>
        </Row>
        {children}
      </Stack>
    </section>
  )
}

export function AppShell({
  controls,
  children,
}: {
  controls: ReactNode
  children: ReactNode
}) {
  const styles = useStyles()
  return (
    <>
      <a className={styles.skip} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.container}>
          <Row spread>
            <Row>
              <Icon name="calculator" filled />
              <Text emphasis>Investment Calculators</Text>
            </Row>
            {controls}
          </Row>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={mergeClasses(styles.container, styles.main)}
      >
        {children}
      </main>
      <footer className={mergeClasses(styles.container, styles.footer)}>
        <Text muted>
          Planning estimates, not predictions or personalized financial advice.
        </Text>
      </footer>
    </>
  )
}
