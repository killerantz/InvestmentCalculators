import { useState } from 'react'
import { Button, ConfirmDialog, Panel, Row, Text } from '@ui'

export function ConfirmationPreview() {
  const [open, setOpen] = useState(false)
  return (
    <Panel title="Focused confirmation" icon="components">
      <Text>
        Destructive actions ask for confirmation in a modal, even when the
        initiating button is far down the page. This example does not remove
        data.
      </Text>
      <Row>
        <Button onClick={() => setOpen(true)}>Preview removal dialog</Button>
      </Row>
      <ConfirmDialog
        open={open}
        title="Remove an illustrative item?"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        Cancel or press Escape to return without an action. Confirming this
        preview only closes the dialog.
      </ConfirmDialog>
    </Panel>
  )
}
