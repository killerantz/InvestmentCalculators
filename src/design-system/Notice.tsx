import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  notice: {
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    borderRadius: tokens.borderRadiusMedium,
    borderLeftWidth: tokens.strokeWidthThick,
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorBrandStroke1,
    overflowWrap: 'anywhere',
  },
  error: {
    borderLeftColor: tokens.colorPaletteRedBorder2,
  },
})

export type NoticeProps = {
  children: ReactNode
  tone?: 'info' | 'error'
  hidden?: boolean
  focusRequest?: number | undefined
}

export function Notice({
  children,
  tone = 'info',
  hidden = false,
  focusRequest,
}: NoticeProps) {
  const styles = useStyles()
  const element = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (
      focusRequest !== undefined &&
      element.current &&
      !element.current.hidden
    ) {
      element.current.focus()
    }
  }, [focusRequest])
  return (
    <div
      ref={element}
      hidden={hidden}
      tabIndex={focusRequest === undefined ? undefined : -1}
      className={mergeClasses(styles.notice, tone === 'error' && styles.error)}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      {children}
    </div>
  )
}
