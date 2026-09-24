import { ChoiceField, Grid, NumberField, TextField } from '@ui'
import type { EditorField } from '../model/editorFields'

export function Fields({ fields }: { fields: readonly EditorField[] }) {
  return (
    <Grid>
      {fields.map(({ id, options, numeric, ...props }) =>
        options ? (
          <ChoiceField key={id} {...props} options={options} />
        ) : numeric ? (
          <NumberField key={id} {...props} />
        ) : (
          <TextField key={id} {...props} />
        ),
      )}
    </Grid>
  )
}
