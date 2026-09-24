import {
  cents,
  effectiveMonthlyRate,
  inflationFactor,
  NumericRangeError,
} from '../numeric'
import { parseProjectionInput } from './projectionValidation'
import type {
  AccountAmounts,
  AccountMonthlyRow,
  AccountSummary,
  IncomeStream,
  PlanAmounts,
  PlanAnnualRow,
  PlanIncomeRow,
  PlanMonthlyRow,
  PlanProjectionOutcome,
  PlanTransferRow,
} from './projectionTypes'
import type { PlanIssue, RateAssumption } from './types'
import { monthIndex } from './validation'

const accountFlowFields = [
  'externalContributionsCents',
  'scheduledWithdrawalsCents',
  'scheduledWithdrawalShortfallCents',
  'transfersInCents',
  'transfersOutCents',
  'transferShortfallCents',
  'rothConversionsInCents',
  'rothConversionsOutCents',
  'automaticWithdrawalsCents',
  'surplusDepositsCents',
  'growthCents',
  'feesCents',
  'realGrowthCents',
] as const
const accountFields = [
  'openingBalanceCents',
  ...accountFlowFields,
  'closingBalanceCents',
  'realClosingBalanceCents',
] as const
const planFlowFields = [
  ...accountFlowFields,
  'incomeCents',
  'requestedSpendingCents',
  'spendingCents',
  'shortfallCents',
] as const

function emptyAccountAmounts(): AccountAmounts {
  return {
    openingBalanceCents: 0,
    externalContributionsCents: 0,
    scheduledWithdrawalsCents: 0,
    scheduledWithdrawalShortfallCents: 0,
    transfersInCents: 0,
    transfersOutCents: 0,
    transferShortfallCents: 0,
    rothConversionsInCents: 0,
    rothConversionsOutCents: 0,
    automaticWithdrawalsCents: 0,
    surplusDepositsCents: 0,
    growthCents: 0,
    feesCents: 0,
    closingBalanceCents: 0,
    realClosingBalanceCents: 0,
    realGrowthCents: 0,
  }
}

function sumAccounts(rows: readonly AccountAmounts[]): AccountAmounts {
  const result = emptyAccountAmounts()
  for (const row of rows)
    for (const field of accountFields)
      result[field] = cents(result[field] + row[field])
  return result
}

function summarizePlan(rows: readonly PlanMonthlyRow[]): PlanAmounts {
  const result: PlanAmounts = {
    ...emptyAccountAmounts(),
    incomeCents: 0,
    requestedSpendingCents: 0,
    spendingCents: 0,
    shortfallCents: 0,
  }
  result.openingBalanceCents = rows[0]?.openingBalanceCents ?? 0
  for (const row of rows) {
    for (const field of planFlowFields)
      result[field] = cents(result[field] + row[field])
    result.closingBalanceCents = row.closingBalanceCents
    result.realClosingBalanceCents = row.realClosingBalanceCents
  }
  return result
}

function summarizeAccounts(rows: readonly PlanMonthlyRow[]): AccountSummary[] {
  const summaries = new Map<string, AccountSummary>()
  for (const row of rows) {
    for (const account of row.accounts) {
      let summary = summaries.get(account.accountId)
      if (!summary) {
        summary = {
          ...emptyAccountAmounts(),
          accountId: account.accountId,
          openingBalanceCents: account.openingBalanceCents,
          firstDepletionMonth: null,
        }
        summaries.set(account.accountId, summary)
      }
      for (const field of accountFlowFields)
        summary[field] = cents(summary[field] + account[field])
      summary.closingBalanceCents = account.closingBalanceCents
      summary.realClosingBalanceCents = account.realClosingBalanceCents
      if (
        account.closingBalanceCents === 0 &&
        summary.firstDepletionMonth === null
      )
        summary.firstDepletionMonth = row.month
    }
  }
  return [...summaries.values()]
}

function monthlyRate(rate: RateAssumption): number {
  // Nominal APR uses fractional equivalent accrual, not actual credit dates.
  return rate.kind === 'effective'
    ? effectiveMonthlyRate(rate.annualRate)
    : Math.expm1(
        (rate.periodsPerYear *
          Math.log1p(rate.annualRate / rate.periodsPerYear)) /
          12,
      )
}

function payment(stream: IncomeStream, elapsedMonths: number): number {
  if (elapsedMonths < 0 || stream.monthlyAmountCents === 0) return 0
  const anniversaries = Math.floor(elapsedMonths / 12)
  return cents(
    stream.monthlyAmountCents *
      Math.exp(Math.log1p(stream.annualIncreaseRate) * anniversaries),
  )
}

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new Error('Validated projection reference was not resolved.')
  return value
}

function annualInstallment(annualCents: number, calendarMonth: number): number {
  // Integer fractions avoid unsafe products and rounding drift near maximum-safe cents.
  const target = BigInt(annualCents)
  const current = (target * BigInt(calendarMonth) + 6n) / 12n
  const previous = (target * BigInt(calendarMonth - 1) + 6n) / 12n
  return Number(current - previous)
}

/**
 * End-month flows: external savings, scheduled-to-spending withdrawals,
 * account transfers/conversions, income, spending, gap funding, then surplus.
 * No taxes, withholding, eligibility assumptions or arrears.
 * Real values use the global projection month and per-account cent rounding.
 * Any unsafe monetary intermediate or total rejects the entire projection.
 */
export function runPlanProjection(value: unknown): PlanProjectionOutcome {
  const errors: PlanIssue[] = []
  const parsed = parseProjectionInput(value, errors)
  if (!parsed) return { ok: false, errors }
  const { input, schedule } = parsed
  const balances = new Map(
    input.schedule.accounts.map((account) => [
      account.id,
      account.startingBalanceCents,
    ]),
  )
  const priorYearEndBalances = new Map(
    input.schedule.accounts.map((account) => [
      account.id,
      account.priorYearEndBalanceCents,
    ]),
  )
  const changes = new Map(
    input.phaseChanges.map((change) => [change.phaseId, change]),
  )
  const phasesById = new Map(schedule.phases.map((phase) => [phase.id, phase]))
  const transferRanges = input.transfers.map((transfer) => ({
    transfer,
    startOffset: required(phasesById.get(transfer.phaseId)).startOffsetMonths,
    endOffset:
      transfer.endPhaseId === null
        ? input.schedule.horizonMonths
        : required(phasesById.get(transfer.endPhaseId ?? transfer.phaseId))
            .endOffsetMonths,
  }))
  const streams = input.incomes.map((stream) => ({
    stream,
    startOffset:
      stream.startAgeMonths -
      (stream.person === 'primary'
        ? input.schedule.primaryAgeMonths
        : required(input.schedule.partnerAgeMonths ?? undefined)),
  }))
  const startIndex = monthIndex(input.schedule.startMonth)
  const monthly: PlanMonthlyRow[] = []
  const annual: PlanAnnualRow[] = []
  let spendingRequest = input.monthlySpendingCents
  let withdrawalOrder = input.withdrawalOrder
  let firstShortfallMonth: number | null = null
  let totalTransferRequestsCents = 0

  try {
    for (const phase of schedule.phases) {
      const change = changes.get(phase.id)
      spendingRequest = change?.monthlySpendingCents ?? spendingRequest
      withdrawalOrder = change?.withdrawalOrder ?? withdrawalOrder
      for (
        let offset = phase.startOffsetMonths;
        offset < phase.endOffsetMonths;
        offset++
      ) {
        const month = offset + 1
        const calendarIndex = startIndex + offset
        const calendarMonth = (calendarIndex % 12) + 1
        const discount = inflationFactor(input.annualInflationRate, month)
        const accounts: AccountMonthlyRow[] = phase.accounts.map(
          ({ accountId, settings }) => {
            const opening = required(balances.get(accountId))
            const growth = cents(opening * monthlyRate(settings.rate))
            const postGrowth = cents(opening + growth)
            const fees = cents(postGrowth * (settings.annualFeeRate / 12))
            const available = cents(
              cents(postGrowth - fees) + settings.monthlyContributionCents,
            )
            const scheduled = Math.min(
              available,
              settings.monthlyWithdrawalCents,
            )
            return {
              ...emptyAccountAmounts(),
              accountId,
              openingBalanceCents: opening,
              externalContributionsCents: settings.monthlyContributionCents,
              scheduledWithdrawalsCents: scheduled,
              scheduledWithdrawalShortfallCents:
                settings.monthlyWithdrawalCents - scheduled,
              growthCents: growth,
              feesCents: fees,
              closingBalanceCents: available - scheduled,
              realGrowthCents: cents(growth / discount),
            }
          },
        )
        const byId = new Map(
          accounts.map((account) => [account.accountId, account]),
        )
        const transfers: PlanTransferRow[] = transferRanges.map(
          ({ transfer, startOffset, endOffset }) => {
            if (offset < startOffset || offset >= endOffset)
              return {
                transferId: transfer.id,
                requestedCents: 0,
                amountCents: 0,
                shortfallCents: 0,
              }
            const source = required(byId.get(transfer.sourceAccountId))
            const destination = required(
              byId.get(transfer.destinationAccountId),
            )
            let requestedCents: number
            let audit: Pick<
              PlanTransferRow,
              'referenceBalanceCents' | 'annualRequestedCents'
            > = {}
            if (transfer.amountKind === 'annual-percentage') {
              const referenceBalanceCents = required(
                priorYearEndBalances.get(transfer.sourceAccountId),
              )
              const annualRequestedCents = cents(
                referenceBalanceCents * transfer.annualRate,
              )
              requestedCents = annualInstallment(
                annualRequestedCents,
                calendarMonth,
              )
              audit = { referenceBalanceCents, annualRequestedCents }
            } else {
              requestedCents = transfer.monthlyAmountCents
            }
            // Nonnegative requests: this total also bounds every entry, phase and reporting interval.
            totalTransferRequestsCents = cents(
              totalTransferRequestsCents + requestedCents,
            )
            const amountCents = Math.min(
              requestedCents,
              source.closingBalanceCents,
            )
            const shortfallCents = requestedCents - amountCents
            source.closingBalanceCents -= amountCents
            destination.closingBalanceCents = cents(
              destination.closingBalanceCents + amountCents,
            )
            source.transfersOutCents = cents(
              source.transfersOutCents + amountCents,
            )
            destination.transfersInCents = cents(
              destination.transfersInCents + amountCents,
            )
            source.transferShortfallCents = cents(
              source.transferShortfallCents + shortfallCents,
            )
            if (transfer.kind === 'roth-conversion') {
              source.rothConversionsOutCents = cents(
                source.rothConversionsOutCents + amountCents,
              )
              destination.rothConversionsInCents = cents(
                destination.rothConversionsInCents + amountCents,
              )
            }
            return {
              transferId: transfer.id,
              requestedCents,
              amountCents,
              shortfallCents,
              ...audit,
            }
          },
        )
        let funds = 0
        for (const account of accounts)
          funds = cents(funds + account.scheduledWithdrawalsCents)
        let incomeCents = 0
        const incomes: PlanIncomeRow[] = streams.map(
          ({ stream, startOffset }) => {
            const amountCents = payment(stream, offset - startOffset)
            incomeCents = cents(incomeCents + amountCents)
            return { incomeId: stream.id, amountCents }
          },
        )
        funds = cents(funds + incomeCents)
        const fundedSpending = Math.min(funds, spendingRequest)
        let gap = spendingRequest - fundedSpending
        for (const accountId of withdrawalOrder) {
          const account = required(byId.get(accountId))
          const amount = Math.min(gap, account.closingBalanceCents)
          account.automaticWithdrawalsCents = amount
          account.closingBalanceCents -= amount
          gap -= amount
          if (gap === 0) break
        }
        const cash = required(byId.get(input.cashAccountId))
        cash.surplusDepositsCents = funds - fundedSpending
        cash.closingBalanceCents = cents(
          cash.closingBalanceCents + cash.surplusDepositsCents,
        )
        for (const account of accounts) {
          account.realClosingBalanceCents = cents(
            account.closingBalanceCents / discount,
          )
          balances.set(account.accountId, account.closingBalanceCents)
          if (calendarMonth === 12)
            priorYearEndBalances.set(
              account.accountId,
              account.closingBalanceCents,
            )
        }
        if (gap > 0 && firstShortfallMonth === null) firstShortfallMonth = month
        monthly.push({
          ...sumAccounts(accounts),
          incomeCents,
          requestedSpendingCents: spendingRequest,
          spendingCents: spendingRequest - gap,
          shortfallCents: gap,
          month,
          calendarMonth: `${String(Math.floor(calendarIndex / 12) + 1).padStart(4, '0')}-${String((calendarIndex % 12) + 1).padStart(2, '0')}`,
          phaseId: phase.id,
          accounts,
          incomes,
          transfers,
        })
      }
    }
    for (let offset = 0; offset < monthly.length; offset += 12) {
      const rows = monthly.slice(offset, offset + 12)
      annual.push({
        ...summarizePlan(rows),
        year: offset / 12 + 1,
        startMonth: required(rows[0]).month,
        endMonth: required(rows.at(-1)).month,
        accounts: summarizeAccounts(rows),
      })
    }
    return {
      ok: true,
      projection: {
        engineVersion: 'plan-projection-1.3.0',
        schedule,
        monthly,
        annual,
        totals: summarizePlan(monthly),
        accounts: summarizeAccounts(monthly),
        firstShortfallMonth,
      },
    }
  } catch (error) {
    if (!(error instanceof NumericRangeError)) throw error
    return {
      ok: false,
      errors: [
        {
          path: 'calculation',
          message:
            'The projection exceeds the supported numeric range. Reduce amounts, rates, or duration.',
        },
      ],
    }
  }
}
