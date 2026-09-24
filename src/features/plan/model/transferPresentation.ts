import type { TransferDraft } from './financeDraft'
import type { CompiledPlan } from '../../../domain/plan'
import type { PlanDraft } from './draft'

export function transferName(transfer: TransferDraft, index: number): string {
  return transfer.label?.trim() || `Transfer ${index + 1}`
}

export function transferRangeLabel(
  transfer: TransferDraft,
  phases: readonly { id: string; label: string }[],
): string {
  const start = phases.find((phase) => phase.id === transfer.phaseId)
  const end = phases.find(
    (phase) => phase.id === (transfer.endPhaseId ?? transfer.phaseId),
  )
  if (
    !start ||
    (transfer.endPhaseId !== null &&
      (!end || phases.indexOf(end) < phases.indexOf(start)))
  )
    return 'Unresolved phase range (validate transfer)'
  if (transfer.endPhaseId === null) return `${start.label} through end of plan`
  if (end?.id === start.id) return `${start.label} only`
  return `${start.label} through ${end?.label} (inclusive)`
}

export function transferIncludesPhase(
  transfer: TransferDraft,
  phaseId: string,
  phases: readonly { id: string }[],
): boolean {
  const start = phases.findIndex((phase) => phase.id === transfer.phaseId)
  const end =
    transfer.endPhaseId === null
      ? phases.length - 1
      : phases.findIndex(
          (phase) => phase.id === (transfer.endPhaseId ?? transfer.phaseId),
        )
  const current = phases.findIndex((phase) => phase.id === phaseId)
  return start >= 0 && end >= start && current >= start && current <= end
}

export function historicalBalanceContext(
  accountId: string,
  draft: PlanDraft,
  schedule: CompiledPlan | null,
) {
  const account = draft.accounts.find((item) => item.id === accountId)
  if (!account) throw new Error('The reference balance account must exist.')
  const firstYear = draft.startMonth.slice(0, 4)
  const required =
    schedule !== null &&
    (draft.finance?.transfers ?? []).some(
      (transfer) =>
        transfer.amountKind === 'annual-percentage' &&
        transfer.sourceAccountId === accountId &&
        schedule.phases.some(
          (phase) =>
            phase.id === transfer.phaseId &&
            phase.startMonth.slice(0, 4) === firstYear,
        ),
    )
  const referenceDate = /^\d{4}-\d{2}$/.test(draft.startMonth)
    ? `December 31, ${Number(firstYear) - 1}`
    : 'December 31 before plan start'
  return {
    visible: required || Boolean(account.priorYearEndBalance?.trim()),
    label: `${referenceDate} balance ($)`,
    hint: required
      ? `Needed because a percentage transfer starts in ${firstYear}, the plan's first calendar year. This earlier balance is outside the projection; it does not add funds. All later years use calculated December balances automatically.`
      : schedule === null
        ? 'Saved reference for the calendar year before plan start. Validate the account and phase settings to determine whether a first-year percentage transfer needs it. Later distributions use calculated December balances.'
        : 'Saved reference for the calendar year before plan start. It is not needed by the current transfer schedule. Later distributions use calculated December balances; clear this value if no longer needed.',
  }
}

export function transferAmountLabel(transfer: TransferDraft): string {
  if (transfer.amountKind === 'annual-percentage')
    return transfer.annualPercentage?.trim()
      ? `${transfer.annualPercentage}% of prior December 31 balance per year; paid monthly`
      : 'Annual percentage not entered'
  return `$${transfer.amount} monthly`
}
