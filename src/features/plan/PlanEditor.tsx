import { usePlanEditor } from './model/usePlanEditor'
import { PlanEditorPage } from './ui/PlanEditorPage'

export function PlanEditor() {
  const model = usePlanEditor()
  return <PlanEditorPage model={model} />
}
