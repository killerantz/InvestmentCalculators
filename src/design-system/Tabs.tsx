import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Tab, TabList, makeStyles, tokens } from '@fluentui/react-components'
import { Row, Stack } from './layout'
import { Button } from './controls'

const useStyles = makeStyles({
  list: {
    flexWrap: 'wrap',
  },
  tab: {
    borderRadius: tokens.borderRadiusMedium,
    '&[aria-selected="true"]': {
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
})

export type TabsProps = {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  children: ReactNode
  showNext?: boolean
}

export function Tabs({
  label,
  value,
  options,
  onChange,
  children,
  showNext = false,
}: TabsProps) {
  const id = useId()
  const styles = useStyles()
  const activePanel = useRef<HTMLDivElement>(null)
  const focusAfterNext = useRef(false)
  const next =
    options[options.findIndex((option) => option.value === value) + 1]
  useLayoutEffect(() => {
    if (focusAfterNext.current) {
      focusAfterNext.current = false
      activePanel.current?.focus({ preventScroll: true })
      activePanel.current?.scrollIntoView({ block: 'start' })
    }
  }, [value])
  return (
    <Stack>
      <TabList
        className={styles.list}
        aria-label={label}
        selectedValue={value}
        onTabSelect={(_, data) => {
          const option = options.find((option) => option.value === data.value)
          if (!option)
            throw new Error('Tabs received an unsupported selection.')
          onChange(option.value)
        }}
      >
        {options.map((option, index) => (
          <Tab
            key={option.value}
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`}
            value={option.value}
            className={styles.tab}
          >
            {option.label}
          </Tab>
        ))}
      </TabList>
      {options.map((option, index) => (
        <div
          ref={option.value === value ? activePanel : undefined}
          key={option.value}
          id={`${id}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${index}`}
          hidden={option.value !== value}
          tabIndex={0}
        >
          {option.value === value ? children : null}
        </div>
      ))}
      {showNext && next && (
        <Row>
          <Button
            appearance="primary"
            onClick={() => {
              focusAfterNext.current = true
              onChange(next.value)
            }}
          >
            Next: {next.label}
          </Button>
        </Row>
      )}
    </Stack>
  )
}
