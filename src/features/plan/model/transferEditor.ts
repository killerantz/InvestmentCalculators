import type { PlanIssue } from '../../../domain/plan'
import type { PlanDraft } from './draft'
import { editorField as field } from './editorFields'
import { financeDraft, type TransferDraft } from './financeDraft'
import { transferName } from './transferPresentation'

export function transferEditor(
  plan: PlanDraft,
  update: (edit: (draft: PlanDraft) => void) => void,
  errors: readonly PlanIssue[],
  remove: (transfer: TransferDraft, label: string) => void,
) {
  const transfers = financeDraft(plan).transfers ?? []
  const accounts = [
    { value: '', label: 'Choose an account' },
    ...plan.accounts.map((account) => ({
      value: account.id,
      label: account.label,
    })),
  ]
  return transfers.map((transfer, index) => {
    const label = transferName(transfer, index)
    const startsInLastPhase = transfer.phaseId === plan.phases.at(-1)?.id
    function edit(key: keyof TransferDraft, value: string) {
      update((draft) => {
        const current = draft.finance?.transfers?.find(
          (item) => item.id === transfer.id,
        )
        if (!current) throw new Error('The transfer being edited must exist.')
        current[key] = value
      })
    }
    function setStart(value: string) {
      update((draft) => {
        const current = draft.finance?.transfers?.find(
          (item) => item.id === transfer.id,
        )
        if (!current) throw new Error('The transfer being edited must exist.')
        current.phaseId = value
        if (value === draft.phases.at(-1)?.id) current.endPhaseId = null
      })
    }
    function setEnd(value: string) {
      update((draft) => {
        const current = draft.finance?.transfers?.find(
          (item) => item.id === transfer.id,
        )
        if (!current) throw new Error('The transfer being edited must exist.')
        current.endPhaseId = value === '' ? null : value
      })
    }
    function move(direction: -1 | 1) {
      update((draft) => {
        const entries = draft.finance?.transfers
        const position = entries?.findIndex((item) => item.id === transfer.id)
        if (
          !entries ||
          position === undefined ||
          position < 0 ||
          position + direction < 0 ||
          position + direction >= entries.length
        )
          throw new Error(
            'Only an existing transfer within the order can be moved.',
          )
        const [entry] = entries.splice(position, 1)
        entries.splice(position + direction, 0, entry!)
      })
    }
    return {
      id: transfer.id,
      label,
      remove: () => remove(transfer, label),
      canMoveEarlier: index > 0,
      canMoveLater: index < transfers.length - 1,
      earlier: () => move(-1),
      later: () => move(1),
      fields: [
        field(
          'label',
          'Transfer name',
          transfer.label ?? label,
          (v) => edit('label', v),
          undefined,
          false,
        ),
        field('kind', 'Transfer type', transfer.kind, (v) => edit('kind', v), [
          { value: 'transfer', label: 'Account-to-account transfer' },
          { value: 'roth-conversion', label: 'Roth conversion' },
        ]),
        field('phaseId', 'Starting phase', transfer.phaseId, setStart, [
          { value: '', label: 'Choose a phase' },
          ...plan.phases.map((phase) => ({
            value: phase.id,
            label: phase.label,
          })),
        ]),
        {
          ...field(
            'endPhaseId',
            'Ending phase (inclusive)',
            startsInLastPhase || transfer.endPhaseId === null
              ? ''
              : (transfer.endPhaseId ?? transfer.phaseId),
            setEnd,
            [
              {
                value: '',
                label: !transfer.phaseId
                  ? 'Choose a starting phase first'
                  : startsInLastPhase
                    ? 'Through end of plan (last phase)'
                    : 'Indefinitely (through end of plan)',
              },
              ...plan.phases.map((phase) => ({
                value: phase.id,
                label: phase.label,
              })),
            ],
            false,
            !transfer.phaseId
              ? 'Choose a starting phase to set the ending.'
              : startsInLastPhase
                ? 'The starting phase is the last phase, so this transfer ends with the plan.'
                : 'Runs through the end of this phase. Separate transfers do not replace this entry; overlapping entries both run.',
          ),
          disabled: startsInLastPhase || !transfer.phaseId,
        },
        field(
          'sourceAccountId',
          'From account',
          transfer.sourceAccountId,
          (v) => edit('sourceAccountId', v),
          accounts,
        ),
        field(
          'destinationAccountId',
          'To account',
          transfer.destinationAccountId,
          (v) => edit('destinationAccountId', v),
          accounts,
        ),
        field(
          'amountKind',
          'Amount method',
          transfer.amountKind ?? 'monthly-dollars',
          (v) => edit('amountKind', v),
          [
            { value: 'monthly-dollars', label: 'Fixed monthly dollars' },
            {
              value: 'annual-percentage',
              label: 'Annual percentage of prior year-end balance',
            },
          ],
        ),
        ...(transfer.amountKind === 'annual-percentage'
          ? [
              field(
                'annualRate',
                'Annual percentage to move (%)',
                transfer.annualPercentage ?? '',
                (v) => edit('annualPercentage', v),
                undefined,
                true,
                'Enter 4 for 4% per year, not per month. Uses the source account balance on the preceding December 31, then pays one-twelfth in each active month.',
              ),
            ]
          : [
              field(
                'monthlyAmountCents',
                'Monthly amount to move ($)',
                transfer.amount,
                (v) => edit('amount', v),
                undefined,
                true,
              ),
            ]),
      ].map((item) => {
        const path = `transfers.${index}.${item.id}`
        const error = errors
          .filter(
            (issue) => issue.path === path || issue.path.startsWith(`${path}.`),
          )
          .map((issue) => issue.message)
          .join(' ')
        return error ? { ...item, error } : item
      }),
    }
  })
}
