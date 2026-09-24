type Option = { value: string; label: string }
export type EditorField = {
  id: string
  label: string
  value: string
  numeric: boolean
  options?: readonly Option[]
  hint?: string
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}
export function editorField(
  id: string,
  label: string,
  value: string,
  onChange: (value: string) => void,
  options?: readonly Option[],
  numeric = true,
  hint?: string,
): EditorField {
  return {
    id,
    label,
    value,
    onChange,
    numeric,
    ...(options ? { options } : {}),
    ...(hint ? { hint } : {}),
  }
}
