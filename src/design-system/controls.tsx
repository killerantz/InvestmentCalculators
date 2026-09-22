import {
  Badge,
  Button as FluentButton,
  Field,
  Select,
  Tooltip,
  makeStyles,
  tokens,
  type ButtonProps as FluentButtonProps,
} from '@fluentui/react-components'
import type { ThemeMode } from './theme/tokens'
import { Icon, type IconName } from './Icon'

const useStyles = makeStyles({
  themeField: {
    gridTemplateColumns: 'max-content max-content',
    columnGap: tokens.spacingHorizontalS,
  },
})

export type ButtonProps = Pick<
  Extract<FluentButtonProps, { as?: 'button' }>,
  'children' | 'onClick' | 'disabled' | 'appearance' | 'aria-pressed'
>

export function Button(props: ButtonProps) {
  return <FluentButton {...props} as="button" type="button" />
}

export function IconButton({
  label,
  icon,
  disabled = false,
  onClick,
}: {
  label: string
  icon: IconName
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip content={label} relationship="label">
      <FluentButton
        type="button"
        aria-label={label}
        disabled={disabled}
        icon={<Icon name={icon} disabled={disabled} />}
        onClick={onClick}
      />
    </Tooltip>
  )
}

export function StatusBadge({ children }: { children: string }) {
  return (
    <Badge appearance="tint" color="brand">
      {children}
    </Badge>
  )
}

export function ThemeSelect({
  value,
  onChange,
}: {
  value: ThemeMode
  onChange: (mode: ThemeMode) => void
}) {
  const styles = useStyles()
  return (
    <Field
      label="Appearance"
      orientation="horizontal"
      className={styles.themeField}
    >
      <Select
        value={value}
        onChange={(_, data) => {
          const mode = data.value
          if (mode !== 'system' && mode !== 'light' && mode !== 'dark') {
            throw new Error(`Unsupported appearance: ${mode}`)
          }
          onChange(mode)
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>
    </Field>
  )
}
