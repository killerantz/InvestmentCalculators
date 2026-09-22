import { useEffect, useState } from 'react'
import {
  Field,
  Input,
  Slider,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { Text } from './typography'
import { IconButton } from './controls'
import { appTokens } from './theme/tokens'
import { parseYearDraft, validateYearBounds } from './yearNavigation'

const useStyles = makeStyles({
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    minWidth: 0,
  },
  field: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    '& > *': {
      minWidth: 0,
    },
  },
  control: {
    minWidth: 0,
    width: '100%',
  },
  entryRow: {
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  yearInput: {
    width: appTokens.yearInputWidth,
    minWidth: 0,
    flexShrink: 0,
  },
})

export type YearNavigatorProps = {
  value: number
  max: number
  onChange: (year: number) => void
}

type YearEntry = {
  value: number
  max: number
  draft: string
  error: string | null
}

export function YearNavigator({ value, max, onChange }: YearNavigatorProps) {
  const styles = useStyles()
  const year = validateYearBounds(value, max)
  const [entry, setEntry] = useState<YearEntry>({
    value,
    max,
    draft: String(year),
    error: null,
  })

  if (entry.value !== value || entry.max !== max) {
    setEntry({ value, max, draft: String(year), error: null })
  }

  useEffect(() => {
    if (value > max) onChange(max)
  }, [value, max, onChange])

  function navigate(next: number) {
    if (!Number.isSafeInteger(next) || next < 1 || next > max) {
      throw new Error(`YearNavigator cannot navigate to year ${next}.`)
    }
    setEntry({ value, max, draft: String(next), error: null })
    if (next !== value) onChange(next)
  }

  function commit() {
    const result = parseYearDraft(entry.draft, max)
    if (result.error !== undefined) {
      setEntry({ ...entry, error: result.error })
      return
    }
    navigate(result.year)
  }

  return (
    <div role="group" aria-label="Year navigation" className={styles.group}>
      <Text>
        Year {year} of {max}
      </Text>
      <Field label="Selected year" className={styles.field}>
        <Slider
          className={styles.control}
          min={1}
          max={max}
          step={1}
          value={year}
          disabled={max === 1}
          aria-valuetext={`Year ${year} of ${max}`}
          onChange={(_, data) => navigate(data.value)}
        />
      </Field>
      <Field
        label="Exact year"
        className={styles.field}
        hint={`Enter a whole year from 1 to ${max}, then press Enter or Go.`}
        validationState={entry.error ? 'error' : 'none'}
        validationMessage={entry.error}
      >
        {(controlProps) => (
          <div className={styles.entryRow}>
            <Input
              {...controlProps}
              className={styles.yearInput}
              type="text"
              inputMode="numeric"
              maxLength={3}
              readOnly={max === 1}
              value={entry.draft}
              onChange={(_, data) =>
                setEntry({ ...entry, draft: data.value, error: null })
              }
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  commit()
                }
              }}
            />
            <IconButton
              label="Previous year"
              icon="previous"
              disabled={year === 1}
              onClick={() => navigate(year - 1)}
            />
            <IconButton
              label="Next year"
              icon="next"
              disabled={year === max}
              onClick={() => navigate(year + 1)}
            />
            <IconButton
              label="Go to year"
              icon="go"
              disabled={max === 1}
              onClick={commit}
            />
          </div>
        )}
      </Field>
    </div>
  )
}
