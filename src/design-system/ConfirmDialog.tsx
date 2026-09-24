import { useId, type ReactNode } from 'react'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components'
import { Button } from './controls'

export function ConfirmDialog({
  open,
  title,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  const descriptionId = useId()
  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onCancel()
      }}
    >
      <DialogSurface aria-describedby={descriptionId}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent id={descriptionId}>{children}</DialogContent>
          <DialogActions>
            <Button onClick={onCancel}>Cancel removal</Button>
            <Button appearance="primary" onClick={onConfirm}>
              Confirm removal
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
