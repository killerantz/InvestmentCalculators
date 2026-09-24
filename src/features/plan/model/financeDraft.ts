import type { PlanDraft } from './draft'

export type IncomeDraft = {
  id: string
  label: string
  kind: string
  person: string
  years: string
  months: string
  amount: string
  increase: string
}
export type CashFlowDraft = {
  spending: string | null
  withdrawalOrder: string[] | null
}
export type TransferDraft = {
  id: string
  label?: string
  phaseId: string
  endPhaseId?: string | null
  kind: string
  sourceAccountId: string
  destinationAccountId: string
  amount: string
  amountKind?: string
  annualPercentage?: string
}
export type FinanceDraft = {
  incomes: IncomeDraft[]
  transfers?: TransferDraft[]
  cashAccountId: string
  spending: string
  withdrawalOrder: string[]
  inflation: string
}
export function financeDraft(plan: PlanDraft): FinanceDraft {
  return (
    plan.finance ?? {
      incomes: [],
      cashAccountId: '',
      spending: '0',
      withdrawalOrder: [],
      inflation: '0',
    }
  )
}
export function inheritedCashFlow(plan: PlanDraft, beforePhase: number) {
  const initial = financeDraft(plan)
  let spending = initial.spending
  let withdrawalOrder = [...initial.withdrawalOrder]
  for (const phase of plan.phases.slice(0, beforePhase)) {
    if (phase.cashFlow?.spending != null) spending = phase.cashFlow.spending
    if (phase.cashFlow?.withdrawalOrder != null)
      withdrawalOrder = [...phase.cashFlow.withdrawalOrder]
  }
  return { spending, withdrawalOrder }
}

export function moveWithdrawal(
  order: readonly string[],
  id: string,
  direction: -1 | 1,
): string[] {
  const index = order.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= order.length)
    throw new Error('Only an included account within the order can be moved.')
  const updated = [...order]
  updated.splice(index, 1)
  updated.splice(target, 0, id)
  return updated
}
