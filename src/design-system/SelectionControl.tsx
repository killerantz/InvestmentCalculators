import { ToggleButton, makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  option: {
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
})

export type SelectionControlProps = {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}

export function SelectionControl({
  label,
  value,
  options,
  onChange,
}: SelectionControlProps) {
  const styles = useStyles()
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          type="button"
          className={styles.option}
          checked={value === option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </ToggleButton>
      ))}
    </div>
  )
}
