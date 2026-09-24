import {
  Field,
  Radio,
  RadioGroup,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'

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
    borderRadius: tokens.borderRadiusMedium,
    borderTopWidth: tokens.strokeWidthThin,
    borderRightWidth: tokens.strokeWidthThin,
    borderBottomWidth: tokens.strokeWidthThin,
    borderLeftWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke1,
    borderRightColor: tokens.colorNeutralStroke1,
    borderBottomColor: tokens.colorNeutralStroke1,
    borderLeftColor: tokens.colorNeutralStroke1,
  },
  selected: {
    backgroundColor: tokens.colorBrandBackground2,
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    fontWeight: tokens.fontWeightSemibold,
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
    <Field label={label}>
      <RadioGroup
        className={styles.group}
        layout="horizontal"
        value={value}
        onChange={(_, data) => {
          if (!options.some((option) => option.value === data.value))
            throw new Error(
              'SelectionControl received an unsupported selection.',
            )
          onChange(data.value)
        }}
      >
        {options.map((option) => (
          <Radio
            key={option.value}
            className={mergeClasses(
              styles.option,
              value === option.value && styles.selected,
            )}
            value={option.value}
            label={option.label}
          />
        ))}
      </RadioGroup>
    </Field>
  )
}
