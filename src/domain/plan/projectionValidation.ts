import { compilePlan } from './compiler'
import type {
  AccountTransfer,
  IncomeStream,
  PhaseCashFlowChange,
  PlanProjectionInput,
} from './projectionTypes'
import type { CompiledPlan, PlanIssue } from './types'
import {
  collection,
  integer,
  money,
  monthIndex,
  object,
  parsePlan,
  text,
} from './validation'

function transfer(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): AccountTransfer | undefined {
  const fields = object(
    value,
    path,
    [
      'id',
      'phaseId',
      'endPhaseId',
      'kind',
      'sourceAccountId',
      'destinationAccountId',
      'monthlyAmountCents',
      'amountKind',
      'annualRate',
    ],
    errors,
  )
  if (!fields) return undefined
  const id = text(fields.id, `${path}.id`, errors)
  const phaseId = text(fields.phaseId, `${path}.phaseId`, errors)
  const endPhaseId = Object.prototype.hasOwnProperty.call(fields, 'endPhaseId')
    ? fields.endPhaseId === null
      ? null
      : text(fields.endPhaseId, `${path}.endPhaseId`, errors)
    : undefined
  const kind = fields.kind
  if (kind !== 'transfer' && kind !== 'roth-conversion')
    errors.push({
      path: `${path}.kind`,
      message: 'Choose transfer or roth-conversion.',
    })
  const sourceAccountId = text(
    fields.sourceAccountId,
    `${path}.sourceAccountId`,
    errors,
  )
  const destinationAccountId = text(
    fields.destinationAccountId,
    `${path}.destinationAccountId`,
    errors,
  )
  if (
    id === undefined ||
    phaseId === undefined ||
    (kind !== 'transfer' && kind !== 'roth-conversion') ||
    sourceAccountId === undefined ||
    destinationAccountId === undefined
  )
    return undefined
  const base = {
    id,
    phaseId,
    ...(endPhaseId === undefined ? {} : { endPhaseId }),
    sourceAccountId,
    destinationAccountId,
  }
  const hasAmountKind = Object.prototype.hasOwnProperty.call(
    fields,
    'amountKind',
  )
  const amountKind = hasAmountKind ? fields.amountKind : 'monthly-dollars'
  if (amountKind === 'annual-percentage') {
    if (Object.prototype.hasOwnProperty.call(fields, 'monthlyAmountCents'))
      errors.push({
        path: `${path}.monthlyAmountCents`,
        message: 'Monthly cents do not apply to an annual-percentage transfer.',
      })
    const annualRate = fields.annualRate
    if (
      typeof annualRate !== 'number' ||
      !Number.isFinite(annualRate) ||
      annualRate < 0
    ) {
      errors.push({
        path: `${path}.annualRate`,
        message: 'Enter a finite annual transfer rate of at least 0.',
      })
      return undefined
    }
    return { ...base, kind, amountKind, annualRate }
  }
  if (amountKind !== 'monthly-dollars') {
    errors.push({
      path: `${path}.amountKind`,
      message: 'Choose monthly-dollars or annual-percentage.',
    })
    return undefined
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'annualRate'))
    errors.push({
      path: `${path}.annualRate`,
      message: 'An annual rate does not apply to a monthly-dollars transfer.',
    })
  const monthlyAmountCents = money(
    fields.monthlyAmountCents,
    `${path}.monthlyAmountCents`,
    errors,
  )
  if (monthlyAmountCents === undefined) return undefined
  return {
    ...base,
    kind,
    ...(hasAmountKind ? { amountKind } : {}),
    monthlyAmountCents,
  }
}

function income(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): IncomeStream | undefined {
  const fields = object(
    value,
    path,
    [
      'id',
      'label',
      'kind',
      'person',
      'startAgeMonths',
      'monthlyAmountCents',
      'annualIncreaseRate',
    ],
    errors,
  )
  if (!fields) return undefined
  const id = text(fields.id, `${path}.id`, errors)
  const label = text(fields.label, `${path}.label`, errors)
  const kind = fields.kind
  if (kind !== 'social-security' && kind !== 'pension')
    errors.push({
      path: `${path}.kind`,
      message: 'Choose social-security or pension.',
    })
  const person = fields.person
  if (person !== 'primary' && person !== 'partner')
    errors.push({
      path: `${path}.person`,
      message: 'Choose primary or partner.',
    })
  const startAgeMonths = integer(
    fields.startAgeMonths,
    `${path}.startAgeMonths`,
    0,
    1_800,
    'Enter whole age months from 0 to 1800.',
    errors,
  )
  const monthlyAmountCents = money(
    fields.monthlyAmountCents,
    `${path}.monthlyAmountCents`,
    errors,
  )
  const annualIncreaseRate = fields.annualIncreaseRate
  const validRate =
    typeof annualIncreaseRate === 'number' &&
    Number.isFinite(annualIncreaseRate) &&
    annualIncreaseRate >= 0
  if (!validRate)
    errors.push({
      path: `${path}.annualIncreaseRate`,
      message: 'Enter a finite annual increase rate of at least 0.',
    })
  if (
    id === undefined ||
    label === undefined ||
    (kind !== 'social-security' && kind !== 'pension') ||
    (person !== 'primary' && person !== 'partner') ||
    startAgeMonths === undefined ||
    monthlyAmountCents === undefined ||
    !validRate
  )
    return undefined
  return {
    id,
    label,
    kind,
    person,
    startAgeMonths,
    monthlyAmountCents,
    annualIncreaseRate,
  }
}

export function parseProjectionInput(
  value: unknown,
  errors: PlanIssue[],
):
  | {
      input: PlanProjectionInput & { transfers: readonly AccountTransfer[] }
      schedule: CompiledPlan
    }
  | undefined {
  const fields = object(
    value,
    '',
    [
      'schedule',
      'incomes',
      'transfers',
      'cashAccountId',
      'monthlySpendingCents',
      'withdrawalOrder',
      'phaseChanges',
      'annualInflationRate',
    ],
    errors,
  )
  if (!fields) return undefined
  // Keep schedule issue paths identical to the compiler's public contract.
  const compiled = compilePlan(fields.schedule)
  if (!compiled.ok) errors.push(...compiled.errors)
  const schedule = parsePlan(fields.schedule, [])
  const accountIds = new Set(schedule?.accounts.map((account) => account.id))
  const phaseIndexes = new Map(
    schedule?.phases.map((phase, index) => [phase.id, index]),
  )
  const accountsById = new Map(
    schedule?.accounts.map((account) => [account.id, account]),
  )
  const transferIds = new Set<string>()
  const transfers = collection(
    Object.prototype.hasOwnProperty.call(fields, 'transfers')
      ? fields.transfers
      : [],
    'transfers',
    false,
    (item, path, issues) => {
      const result = transfer(item, path, issues)
      if (!result) return undefined
      if (transferIds.has(result.id))
        issues.push({
          path: `${path}.id`,
          message: 'Transfer IDs must be unique.',
        })
      transferIds.add(result.id)
      if (schedule && !phaseIndexes.has(result.phaseId))
        issues.push({
          path: `${path}.phaseId`,
          message: 'The referenced phase does not exist.',
        })
      if (schedule && typeof result.endPhaseId === 'string') {
        const startIndex = phaseIndexes.get(result.phaseId)
        const endIndex = phaseIndexes.get(result.endPhaseId)
        if (endIndex === undefined)
          issues.push({
            path: `${path}.endPhaseId`,
            message: 'The referenced phase does not exist.',
          })
        else if (startIndex !== undefined && endIndex < startIndex)
          issues.push({
            path: `${path}.endPhaseId`,
            message:
              'The ending phase must be the starting phase or a later phase.',
          })
      }
      const source = accountsById.get(result.sourceAccountId)
      const destination = accountsById.get(result.destinationAccountId)
      if (schedule && !source)
        issues.push({
          path: `${path}.sourceAccountId`,
          message: 'The referenced account does not exist.',
        })
      if (schedule && !destination)
        issues.push({
          path: `${path}.destinationAccountId`,
          message: 'The referenced account does not exist.',
        })
      if (result.sourceAccountId === result.destinationAccountId)
        issues.push({
          path: `${path}.destinationAccountId`,
          message: 'Choose a destination different from the source account.',
        })
      if (result.kind === 'roth-conversion') {
        if (
          source &&
          source.kind !== 'traditional-401k' &&
          source.kind !== 'traditional-ira'
        )
          issues.push({
            path: `${path}.sourceAccountId`,
            message:
              'Roth conversions require a traditional 401(k) or IRA source.',
          })
        if (
          destination &&
          destination.kind !== 'roth-401k' &&
          destination.kind !== 'roth-ira'
        )
          issues.push({
            path: `${path}.destinationAccountId`,
            message:
              'Roth conversions require a Roth 401(k) or IRA destination.',
          })
        if (
          source &&
          destination &&
          (source.owner === 'joint' ||
            destination.owner === 'joint' ||
            source.owner !== destination.owner)
        )
          issues.push({
            path: `${path}.destinationAccountId`,
            message: 'Roth conversions require the same individual owner.',
          })
      }
      return result
    },
    errors,
  )
  if (schedule && compiled.ok && transfers) {
    const firstYearEndOffset = 12 - (monthIndex(schedule.startMonth) % 12)
    const firstYearPhases = new Set(
      compiled.plan.phases
        .filter((phase) => phase.startOffsetMonths < firstYearEndOffset)
        .map((phase) => phase.id),
    )
    const firstYearSources = new Set(
      transfers
        .filter(
          (item) =>
            item.amountKind === 'annual-percentage' &&
            firstYearPhases.has(item.phaseId),
        )
        .map((item) => item.sourceAccountId),
    )
    schedule.accounts.forEach((account, index) => {
      if (
        firstYearSources.has(account.id) &&
        account.priorYearEndBalanceCents === undefined
      )
        errors.push({
          path: `accounts.${index}.priorYearEndBalanceCents`,
          message:
            'Enter the prior calendar year-end balance for first-year percentage transfers.',
        })
    })
  }

  const order = (value: unknown, path: string, issues: PlanIssue[]) => {
    const seen = new Set<string>()
    return collection(
      value,
      path,
      false,
      (item, itemPath, itemIssues) => {
        const id = text(item, itemPath, itemIssues)
        if (id !== undefined) {
          if (schedule && !accountIds.has(id))
            itemIssues.push({
              path: itemPath,
              message: 'The referenced account does not exist.',
            })
          if (seen.has(id))
            itemIssues.push({
              path: itemPath,
              message: 'Withdrawal order must not repeat an account.',
            })
          seen.add(id)
        }
        return id
      },
      issues,
    )
  }
  const incomes = collection(fields.incomes, 'incomes', false, income, errors)
  const incomeIds = new Set<string>()
  const incomeLabels = new Set<string>()
  incomes?.forEach((stream, index) => {
    const path = `incomes.${index}`
    if (incomeIds.has(stream.id))
      errors.push({ path: `${path}.id`, message: 'Income IDs must be unique.' })
    if (incomeLabels.has(stream.label))
      errors.push({
        path: `${path}.label`,
        message: 'Income labels must be unique.',
      })
    incomeIds.add(stream.id)
    incomeLabels.add(stream.label)
    if (stream.person === 'partner' && schedule?.partnerAgeMonths === null)
      errors.push({
        path: `${path}.person`,
        message: 'Partner income requires a partner.',
      })
  })
  const cashAccountId = text(fields.cashAccountId, 'cashAccountId', errors)
  if (cashAccountId !== undefined && schedule) {
    const account = schedule.accounts.find((item) => item.id === cashAccountId)
    if (!account)
      errors.push({
        path: 'cashAccountId',
        message: 'The referenced account does not exist.',
      })
    else if (account.kind !== 'savings' && account.kind !== 'aggregate')
      errors.push({
        path: 'cashAccountId',
        message:
          'Choose a savings account or the sole aggregate account for surplus deposits.',
      })
  }
  const monthlySpendingCents = money(
    fields.monthlySpendingCents,
    'monthlySpendingCents',
    errors,
  )
  const withdrawalOrder = order(
    fields.withdrawalOrder,
    'withdrawalOrder',
    errors,
  )
  const seenPhases = new Set<string>()
  const phaseChanges = collection<PhaseCashFlowChange>(
    fields.phaseChanges,
    'phaseChanges',
    false,
    (item, itemPath, issues) => {
      const change = object(
        item,
        itemPath,
        ['phaseId', 'monthlySpendingCents', 'withdrawalOrder'],
        issues,
      )
      if (!change) return undefined
      const phaseId = text(change.phaseId, `${itemPath}.phaseId`, issues)
      const index =
        typeof phaseId === 'string' ? phaseIndexes.get(phaseId) : undefined
      const path = index === undefined ? itemPath : `phases.${index}.cashFlow`
      // Also map unsupported fields into the owning phase's UI error namespace.
      if (path !== itemPath) {
        for (const issue of issues) {
          if (issue.path.startsWith(`${itemPath}.`))
            issue.path = path + issue.path.slice(itemPath.length)
        }
      }
      if (phaseId === undefined) return undefined
      if (schedule && !phaseIndexes.has(phaseId))
        issues.push({
          path: `${path}.phaseId`,
          message: 'The referenced phase does not exist.',
        })
      if (seenPhases.has(phaseId))
        issues.push({
          path: `${path}.phaseId`,
          message: 'A phase can have only one cash-flow change.',
        })
      seenPhases.add(phaseId)
      const result: PhaseCashFlowChange = { phaseId }
      if (
        Object.prototype.hasOwnProperty.call(change, 'monthlySpendingCents')
      ) {
        const spending = money(
          change.monthlySpendingCents,
          `${path}.monthlySpendingCents`,
          issues,
        )
        if (spending !== undefined) result.monthlySpendingCents = spending
      }
      if (Object.prototype.hasOwnProperty.call(change, 'withdrawalOrder')) {
        const ids = order(
          change.withdrawalOrder,
          `${path}.withdrawalOrder`,
          issues,
        )
        if (ids !== undefined) result.withdrawalOrder = ids
      }
      return result
    },
    errors,
  )
  const annualInflationRate = fields.annualInflationRate
  const validInflation =
    typeof annualInflationRate === 'number' &&
    Number.isFinite(annualInflationRate) &&
    annualInflationRate > -1
  if (!validInflation)
    errors.push({
      path: 'annualInflationRate',
      message: 'Enter a finite annual inflation rate greater than -1.',
    })
  if (
    errors.length > 0 ||
    !compiled.ok ||
    schedule === undefined ||
    incomes === undefined ||
    transfers === undefined ||
    cashAccountId === undefined ||
    monthlySpendingCents === undefined ||
    withdrawalOrder === undefined ||
    phaseChanges === undefined ||
    !validInflation
  )
    return undefined
  return {
    input: {
      schedule,
      incomes,
      transfers,
      cashAccountId,
      monthlySpendingCents,
      withdrawalOrder,
      phaseChanges,
      annualInflationRate,
    },
    schedule: compiled.plan,
  }
}
