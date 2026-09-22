import type { ReactNode } from 'react'
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  text: {
    margin: 0,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
    overflowWrap: 'anywhere',
  },
  muted: { color: tokens.colorNeutralForeground2 },
  emphasis: { fontWeight: tokens.fontWeightSemibold },
  heading: {
    margin: 0,
    fontFamily: tokens.fontFamilyBase,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflowWrap: 'anywhere',
  },
  title: {
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
  },
  section: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase500,
  },
})

export function Heading({
  level,
  id,
  children,
}: {
  level: 1 | 2
  id?: string
  children: ReactNode
}) {
  const styles = useStyles()
  const Tag = level === 1 ? 'h1' : 'h2'
  return (
    <Tag
      id={id}
      className={mergeClasses(
        styles.heading,
        level === 1 ? styles.title : styles.section,
      )}
    >
      {children}
    </Tag>
  )
}

export function Text({
  children,
  muted = false,
  emphasis = false,
}: {
  children: ReactNode
  muted?: boolean
  emphasis?: boolean
}) {
  const styles = useStyles()
  return (
    <p
      className={mergeClasses(
        styles.text,
        muted && styles.muted,
        emphasis && styles.emphasis,
      )}
    >
      {children}
    </p>
  )
}
