import { runPlanProjection, type PlanIssue } from '../../../domain/plan'
import {
  parseMoney,
  parsePercentage,
  type ParsedNumber,
} from '../../../shared/numbers'
import type { PlanDraft } from './draft'
import { parsePlanDraft } from './evaluate'
import { financeDraft } from './financeDraft'
import { parseTaxDraft } from './taxDraft'

export function evaluateProjection(draft: PlanDraft) {
  const schedule = parsePlanDraft(draft)
  if (!schedule.ok) return schedule
  const errors: PlanIssue[] = []
  const finance = financeDraft(draft)
  for (const [index, transfer] of (finance.transfers ?? []).entries())
    if (transfer.label !== undefined && !transfer.label.trim())
      errors.push({
        path: `transfers.${index}.label`,
        message: 'Enter a transfer name.',
      })
  function parsed(value: ParsedNumber, path: string) {
    if (value.ok) return value.value
    errors.push({ path, message: value.error })
    return undefined
  }
  const incomes = finance.incomes.map((income, index) => {
    const path = `incomes.${index}`
    const years = Number(income.years)
    const months = Number(income.months)
    if (
      !/^\d+$/.test(income.years.trim()) ||
      !/^\d+$/.test(income.months.trim()) ||
      !Number.isSafeInteger(years * 12 + months) ||
      months > 11
    )
      errors.push({
        path: `${path}.startAgeMonths`,
        message: 'Enter whole age years and additional months from 0 to 11.',
      })
    return {
      id: income.id,
      label: income.label.trim(),
      kind: income.kind,
      person: income.person,
      startAgeMonths: years * 12 + months,
      monthlyAmountCents: parsed(
        parseMoney(income.amount),
        `${path}.monthlyAmountCents`,
      ),
      annualIncreaseRate: parsed(
        parsePercentage(income.increase),
        `${path}.annualIncreaseRate`,
      ),
    }
  })
  const input = {
    ...(draft.taxes?.enabled ? { taxes: parseTaxDraft(draft, errors) } : {}),
    schedule: schedule.input,
    incomes,
    transfers: (finance.transfers ?? []).map((transfer, index) => ({
      id: transfer.id,
      phaseId: transfer.phaseId,
      ...(transfer.endPhaseId === undefined
        ? {}
        : { endPhaseId: transfer.endPhaseId }),
      kind: transfer.kind,
      sourceAccountId: transfer.sourceAccountId,
      destinationAccountId: transfer.destinationAccountId,
      amountKind: transfer.amountKind ?? 'monthly-dollars',
      ...(transfer.amountKind === 'annual-percentage'
        ? {
            annualRate: parsed(
              parsePercentage(transfer.annualPercentage ?? ''),
              `transfers.${index}.annualRate`,
            ),
          }
        : {
            monthlyAmountCents: parsed(
              parseMoney(transfer.amount),
              `transfers.${index}.monthlyAmountCents`,
            ),
          }),
    })),
    cashAccountId: finance.cashAccountId,
    monthlySpendingCents: parsed(
      parseMoney(finance.spending),
      'monthlySpendingCents',
    ),
    annualInflationRate: parsed(
      parsePercentage(finance.inflation),
      'annualInflationRate',
    ),
    withdrawalOrder: finance.withdrawalOrder,
    phaseChanges: draft.phases.flatMap((phase, index) => {
      const flow = phase.cashFlow
      if (!flow || (flow.spending === null && flow.withdrawalOrder === null))
        return []
      return [
        {
          phaseId: phase.id,
          ...(flow.spending === null
            ? {}
            : {
                monthlySpendingCents: parsed(
                  parseMoney(flow.spending),
                  `phases.${index}.cashFlow.monthlySpendingCents`,
                ),
              }),
          ...(flow.withdrawalOrder === null
            ? {}
            : { withdrawalOrder: flow.withdrawalOrder }),
        },
      ]
    }),
  }
  return errors.length
    ? { ok: false as const, errors }
    : runPlanProjection(input)
}
