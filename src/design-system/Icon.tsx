import {
  Calculator24Filled,
  Calculator24Regular,
  ChevronLeft24Filled,
  ChevronLeft24Regular,
  ChevronRight24Filled,
  ChevronRight24Regular,
  ArrowEnterLeft24Filled,
  ArrowEnterLeft24Regular,
  Color24Filled,
  Color24Regular,
  Grid24Filled,
  Grid24Regular,
  ShieldCheckmark24Filled,
  ShieldCheckmark24Regular,
  bundleIcon,
} from '@fluentui/react-icons'
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { appTokens } from './theme/tokens'

const icons = {
  calculator: bundleIcon(Calculator24Filled, Calculator24Regular),
  theme: bundleIcon(Color24Filled, Color24Regular),
  components: bundleIcon(Grid24Filled, Grid24Regular),
  boundaries: bundleIcon(ShieldCheckmark24Filled, ShieldCheckmark24Regular),
  previous: bundleIcon(ChevronLeft24Filled, ChevronLeft24Regular),
  next: bundleIcon(ChevronRight24Filled, ChevronRight24Regular),
  go: bundleIcon(ArrowEnterLeft24Filled, ArrowEnterLeft24Regular),
}

export type IconName = keyof typeof icons

const useStyles = makeStyles({
  root: {
    width: appTokens.iconSize,
    height: appTokens.iconSize,
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
  },
  disabled: {
    color: tokens.colorNeutralForegroundDisabled,
  },
})

export function Icon({
  name,
  filled = false,
  disabled = false,
}: {
  name: IconName
  filled?: boolean
  disabled?: boolean
}) {
  const styles = useStyles()
  const Component = icons[name]
  return (
    <Component
      filled={filled}
      className={mergeClasses(styles.root, disabled && styles.disabled)}
      aria-hidden="true"
    />
  )
}
