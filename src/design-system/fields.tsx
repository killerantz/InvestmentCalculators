import {
  Checkbox,
  Field,
  Input,
  Select,
  makeStyles,
} from '@fluentui/react-components'

const useStyles = makeStyles({
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
})

export type NumberFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
}: NumberFieldProps) {
  const styles = useStyles()
  return (
    <Field
      className={styles.field}
      orientation="vertical"
      label={label}
      hint={hint ?? null}
      validationMessage={error ?? null}
      validationState={error ? 'error' : 'none'}
    >
      <Input
        className={styles.control}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(_, data) => onChange(data.value)}
      />
    </Field>
  )
}

export type ChoiceFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  hint?: string
}

export function ChoiceField({
  label,
  value,
  onChange,
  options,
  hint,
}: ChoiceFieldProps) {
  const styles = useStyles()
  return (
    <Field
      className={styles.field}
      orientation="vertical"
      label={label}
      hint={hint ?? null}
    >
      <Select
        className={styles.control}
        select={{ className: styles.control }}
        value={value}
        onChange={(_, data) => onChange(data.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export type CheckboxFieldProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: CheckboxFieldProps) {
  const styles = useStyles()
  return (
    <Checkbox
      className={styles.field}
      label={label}
      checked={checked}
      onChange={(_, data) => onChange(data.checked === true)}
    />
  )
}
