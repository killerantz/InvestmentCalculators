import type { CashFlowDraft, FinanceDraft } from './financeDraft'
import type { TaxDraft } from './taxDraft'

export type RateDraft = {
  rateKind: string
  annualRate: string
  compounding: string
}
export type SettingsDraft = RateDraft & {
  contribution: string
  withdrawal: string
  fee: string
}
export type AccountDraft = SettingsDraft & {
  id: string
  label: string
  kind: string
  owner: string
  balance: string
  priorYearEndBalance?: string
}
export type ChangeDraft = {
  contribution: string | null
  withdrawal: string | null
  fee: string | null
  rate: RateDraft | null
}
export type PhaseDraft = {
  id: string
  label: string
  person: string
  years: string
  months: string
  changes: Record<string, ChangeDraft>
  cashFlow?: CashFlowDraft
}
export type PlanDraft = {
  id: string
  label: string
  startMonth: string
  horizonMonths: string
  duration?: { years: string; months: string }
  primaryYears: string
  primaryMonths: string
  partnerEnabled: boolean
  partnerYears: string
  partnerMonths: string
  accounts: AccountDraft[]
  phases: PhaseDraft[]
  finance?: FinanceDraft
  taxes?: TaxDraft
}
export const emptyChange = (): ChangeDraft => ({
  contribution: null,
  withdrawal: null,
  fee: null,
  rate: null,
})

export function durationDraft(plan: PlanDraft): {
  years: string
  months: string
} {
  if (plan.duration) return plan.duration
  // Preserve drafts already open in the month-based editor.
  const months = Number(plan.horizonMonths)
  if (
    !/^\d+$/.test(plan.horizonMonths.trim()) ||
    !Number.isSafeInteger(months)
  ) {
    return { years: plan.horizonMonths, months: '0' }
  }
  return { years: String(Math.floor(months / 12)), months: String(months % 12) }
}
export function newAccount(id: string): AccountDraft {
  return {
    id,
    label: 'New account',
    kind: 'savings',
    owner: 'primary',
    balance: '0',
    contribution: '0',
    withdrawal: '0',
    fee: '0',
    rateKind: 'effective',
    annualRate: '3',
    compounding: '12',
  }
}
export function createExamplePlan(): PlanDraft {
  return {
    id: 'example',
    label: 'Illustrative plan',
    startMonth: '2026-01',
    horizonMonths: '480',
    primaryYears: '40',
    primaryMonths: '0',
    partnerEnabled: false,
    partnerYears: '38',
    partnerMonths: '0',
    finance: {
      incomes: [],
      cashAccountId: 'cash',
      spending: '0',
      withdrawalOrder: ['cash'],
      inflation: '0',
    },
    accounts: [
      {
        ...newAccount('cash'),
        label: 'Cash reserve',
        balance: '10000',
        contribution: '100',
      },
      {
        ...newAccount('workplace'),
        label: 'Workplace savings',
        kind: 'traditional-401k',
        balance: '50000',
        contribution: '500',
        annualRate: '5',
      },
    ],
    phases: [
      {
        id: 'start',
        label: 'Accumulation',
        person: 'primary',
        years: '40',
        months: '0',
        changes: {},
      },
      {
        id: 'step-up',
        label: 'Savings step-up',
        person: 'primary',
        years: '50',
        months: '0',
        changes: { workplace: { ...emptyChange(), contribution: '750' } },
      },
      {
        id: 'bridge',
        label: 'Retirement bridge',
        person: 'primary',
        years: '60',
        months: '0',
        changes: { workplace: { ...emptyChange(), contribution: '0' } },
      },
    ],
  }
}
export function copyPlan(plan: PlanDraft, id: string): PlanDraft {
  return { ...structuredClone(plan), id, label: `${plan.label} copy` }
}
export function hasAccountChanges(plan: PlanDraft, id: string): boolean {
  return plan.phases.some((phase) => {
    const change = phase.changes[id]
    return change && Object.values(change).some((value) => value !== null)
  })
}

export function removeAccount(plan: PlanDraft, id: string): void {
  if (
    plan.accounts.length <= 1 ||
    !plan.accounts.some((account) => account.id === id)
  ) {
    throw new Error(
      'Only an existing account in a multi-account plan can be removed.',
    )
  }
  plan.accounts = plan.accounts.filter((account) => account.id !== id)
  if (plan.taxes) {
    delete plan.taxes.accounts[id]
    if (plan.taxes.paymentOrder)
      plan.taxes.paymentOrder = plan.taxes.paymentOrder.filter(
        (accountId) => accountId !== id,
      )
    for (const override of Object.values(plan.taxes.phaseRates))
      if (override.paymentOrder)
        override.paymentOrder = override.paymentOrder.filter(
          (accountId) => accountId !== id,
        )
  }
  for (const phase of plan.phases) {
    delete phase.changes[id]
    if (phase.cashFlow?.withdrawalOrder)
      phase.cashFlow.withdrawalOrder = phase.cashFlow.withdrawalOrder.filter(
        (accountId) => accountId !== id,
      )
  }
  if (plan.finance) {
    if (plan.finance.transfers)
      plan.finance.transfers = plan.finance.transfers.filter(
        (transfer) =>
          transfer.sourceAccountId !== id &&
          transfer.destinationAccountId !== id,
      )
    plan.finance.withdrawalOrder = plan.finance.withdrawalOrder.filter(
      (accountId) => accountId !== id,
    )
    if (plan.finance.cashAccountId === id) plan.finance.cashAccountId = ''
  }
}

export function removePhase(plan: PlanDraft, id: string): void {
  if (!plan.phases.slice(1).some((phase) => phase.id === id)) {
    throw new Error(
      'Only an existing phase after the planning start can be removed.',
    )
  }
  plan.phases = plan.phases.filter((phase) => phase.id !== id)
  if (plan.taxes) delete plan.taxes.phaseRates[id]
  if (plan.finance?.transfers)
    plan.finance.transfers = plan.finance.transfers.filter(
      (transfer) => transfer.phaseId !== id && transfer.endPhaseId !== id,
    )
}
export function inheritedSettings(
  plan: PlanDraft,
  beforePhase: number,
  id: string,
): SettingsDraft {
  const account = plan.accounts.find((item) => item.id === id)
  if (!account) throw new Error('Cannot resolve a missing account.')
  let settings: SettingsDraft = { ...account }
  for (const phase of plan.phases.slice(0, beforePhase)) {
    const change = phase.changes[id]
    if (!change) continue
    settings = {
      ...settings,
      ...(change.contribution !== null
        ? { contribution: change.contribution }
        : {}),
      ...(change.withdrawal !== null ? { withdrawal: change.withdrawal } : {}),
      ...(change.fee !== null ? { fee: change.fee } : {}),
      ...change.rate,
    }
  }
  return settings
}
