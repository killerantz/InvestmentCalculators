import type { CompiledPlan } from '../../../domain/plan'
import { formatMoney } from '../../../shared/numbers'
import type { PlanDraft } from './draft'
import { inheritedCashFlow } from './financeDraft'
import { formatAge as age, planAges } from './planAges'
import {
  transferAmountLabel,
  transferIncludesPhase,
  transferName,
} from './transferPresentation'

const percent = (rate: number) => `${Number((rate * 100).toPrecision(12))}%`

export function scheduleView(plan: CompiledPlan, draft: PlanDraft) {
  const endPhase = plan.phases.at(-1)
  if (!endPhase) throw new Error('A compiled plan requires at least one phase.')
  const total = endPhase.endOffsetMonths
  const ages = planAges(plan)
  const source = (id: string | null) =>
    id === null
      ? 'Account default'
      : (draft.phases.find((phase) => phase.id === id)?.label ?? id)
  return {
    total,
    planEndSummary: ages.endSummary,
    durationLabel: `${age(total)} planned`,
    end: plan.endMonthExclusive,
    version: plan.version,
    phaseColumns: [
      'Phase',
      'Start month',
      'End (exclusive)',
      'Duration (years / months)',
      ...(plan.phases[0]?.partnerAgeMonths === null
        ? ['Start age (primary)', 'End age (primary)']
        : ['Start ages (primary, partner)', 'End ages (primary, partner)']),
    ],
    timeline: plan.phases.map((phase, index) => ({
      id: phase.id,
      label: `Phase ${index + 1}: ${phase.label}`,
      start: phase.startOffsetMonths,
      end: phase.endOffsetMonths,
      detail: `${phase.startMonth} to ${phase.endMonthExclusive} (end exclusive); duration ${age(phase.endOffsetMonths - phase.startOffsetMonths)}; primary ${age(phase.primaryAgeMonths)}${phase.partnerAgeMonths === null ? '' : `; partner ${age(phase.partnerAgeMonths)}`}`,
    })),
    phaseRows: plan.phases.map((phase, index) => ({
      id: phase.id,
      cells: [
        `${index + 1}. ${phase.label}`,
        phase.startMonth,
        phase.endMonthExclusive,
        age(phase.endOffsetMonths - phase.startOffsetMonths),
        ages.ledgerAge(phase.startOffsetMonths),
        ages.ledgerAge(phase.endOffsetMonths),
      ],
    })),
    phases: plan.phases.map((phase, index) => ({
      id: phase.id,
      label: phase.label,
      spending: `$${inheritedCashFlow(draft, index + 1).spending} monthly (nominal)`,
      withdrawalOrder:
        inheritedCashFlow(draft, index + 1)
          .withdrawalOrder.map(
            (id) =>
              draft.accounts.find((account) => account.id === id)?.label ?? id,
          )
          .join(' > ') || 'No automatic withdrawals',
      transfers: (draft.finance?.transfers ?? []).flatMap(
        (transfer, priority) =>
          !transferIncludesPhase(transfer, phase.id, plan.phases)
            ? []
            : [
                {
                  id: transfer.id,
                  cells: [
                    transferName(transfer, priority),
                    transfer.kind === 'roth-conversion'
                      ? 'Roth conversion'
                      : 'Account transfer',
                    draft.accounts.find(
                      (account) => account.id === transfer.sourceAccountId,
                    )?.label ?? transfer.sourceAccountId,
                    draft.accounts.find(
                      (account) => account.id === transfer.destinationAccountId,
                    )?.label ?? transfer.destinationAccountId,
                    transferAmountLabel(transfer),
                  ],
                },
              ],
      ),
      rows: phase.accounts.map((account) => {
        const { settings, sources } = account
        return {
          id: account.accountId,
          cells: [
            draft.accounts.find((item) => item.id === account.accountId)
              ?.label ?? account.accountId,
            `${formatMoney(settings.monthlyContributionCents)} / ${source(sources.monthlyContributionCents)}`,
            `${formatMoney(settings.monthlyWithdrawalCents)} / ${source(sources.monthlyWithdrawalCents)}`,
            `${percent(settings.annualFeeRate)} / ${source(sources.annualFeeRate)}`,
            `${percent(settings.rate.annualRate)} ${settings.rate.kind === 'effective' ? 'effective annual' : `nominal, ${settings.rate.periodsPerYear} periods/year`} / ${source(sources.rate)}`,
          ],
        }
      }),
    })),
  }
}
