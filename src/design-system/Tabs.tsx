import { useId, type ReactNode } from 'react'
import { Tab, TabList, makeStyles, tokens } from '@fluentui/react-components'
import { Stack } from './layout'

const useStyles = makeStyles({
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
}

export function Tabs({ label, value, options, onChange, children }: TabsProps) {
  const id = useId()
  const styles = useStyles()
  return (
    <Stack>
      <TabList
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
    </Stack>
  )
}
