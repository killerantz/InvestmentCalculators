import type { IncomeStream } from './projectionTypes'
import type {
  PlanTaxAssumptions,
  PlanTaxPhaseRates,
  PlanTaxRates,
} from './taxTypes'
import type { PlanInput, PlanIssue } from './types'
import { collection, money, object, text } from './validation'
import { accountOrder } from './orderValidation'

const rateKeys = [
  'ordinaryRate',
  'capitalGainsRate',
  'qualifiedDividendRate',
] as const

function fraction(
  value: unknown,
  path: string,
  errors: PlanIssue[],
  maximum = 1,
): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum
  ) {
    errors.push({
      path,
      message: `Enter a finite rate or share from 0 to ${maximum}.`,
    })
    return undefined
  }
  return value
}

export function parseTaxes(
  value: unknown,
  schedule: PlanInput | undefined,
  incomes: readonly IncomeStream[] | undefined,
  errors: PlanIssue[],
): PlanTaxAssumptions | undefined {
  const fields = object(
    value,
    'taxes',
    [...rateKeys, 'accounts', 'incomes', 'phaseRates', 'paymentOrder'],
    errors,
  )
  if (!fields) return undefined
  const fundingIds = schedule
    ? new Set(schedule.accounts.map((account) => account.id))
    : undefined
  const paymentOrder = Object.prototype.hasOwnProperty.call(
    fields,
    'paymentOrder',
  )
    ? accountOrder(
        fields.paymentOrder,
        'taxes.paymentOrder',
        errors,
        fundingIds,
      )
    : undefined
  const rates: PlanTaxRates = {
    ordinaryRate: 0,
    capitalGainsRate: 0,
    qualifiedDividendRate: 0,
  }
  for (const key of rateKeys)
    rates[key] = fraction(fields[key], `taxes.${key}`, errors) ?? 0

  schedule?.accounts.forEach((account, index) => {
    if (account.kind === 'aggregate')
      errors.push({
        path: `accounts.${index}.kind`,
        message:
          'Estimated taxes do not support aggregate accounts with unknown mixed tax treatment.',
      })
  })
  const accountIds = new Set<string>()
  const accounts = collection(
    fields.accounts,
    'taxes.accounts',
    false,
    (value, path, issues) => {
      const item = object(
        value,
        path,
        [
          'accountId',
          'costBasisCents',
          'annualDividendYield',
          'qualifiedDividendShare',
        ],
        issues,
      )
      if (!item) return undefined
      const accountId = text(item.accountId, `${path}.accountId`, issues)
      const costBasisCents = money(
        item.costBasisCents,
        `${path}.costBasisCents`,
        issues,
      )
      const annualDividendYield = fraction(
        item.annualDividendYield,
        `${path}.annualDividendYield`,
        issues,
      )
      const qualifiedDividendShare = fraction(
        item.qualifiedDividendShare,
        `${path}.qualifiedDividendShare`,
        issues,
      )
      if (accountId !== undefined) {
        if (accountIds.has(accountId))
          issues.push({
            path: `${path}.accountId`,
            message: 'Tax account references must be unique.',
          })
        accountIds.add(accountId)
        if (
          schedule &&
          !schedule.accounts.some(
            (account) => account.id === accountId && account.kind === 'taxable',
          )
        )
          issues.push({
            path: `${path}.accountId`,
            message: 'Reference an existing taxable brokerage account.',
          })
      }
      if (
        accountId === undefined ||
        costBasisCents === undefined ||
        annualDividendYield === undefined ||
        qualifiedDividendShare === undefined
      )
        return undefined
      return {
        accountId,
        costBasisCents,
        annualDividendYield,
        qualifiedDividendShare,
      }
    },
    errors,
  )
  for (const account of schedule?.accounts ?? [])
    if (account.kind === 'taxable' && !accountIds.has(account.id))
      errors.push({
        path: 'taxes.accounts',
        message: `Provide tax assumptions for taxable account "${account.id}".`,
      })

  const incomeIds = new Set<string>()
  const taxIncomes = collection(
    fields.incomes,
    'taxes.incomes',
    false,
    (value, path, issues) => {
      const item = object(value, path, ['incomeId', 'taxableShare'], issues)
      if (!item) return undefined
      const incomeId = text(item.incomeId, `${path}.incomeId`, issues)
      const stream = incomes?.find((income) => income.id === incomeId)
      const taxableShare = fraction(
        item.taxableShare,
        `${path}.taxableShare`,
        issues,
        stream?.kind === 'social-security' ? 0.85 : 1,
      )
      if (incomeId !== undefined) {
        if (incomeIds.has(incomeId))
          issues.push({
            path: `${path}.incomeId`,
            message: 'Tax income references must be unique.',
          })
        incomeIds.add(incomeId)
        if (incomes && !stream)
          issues.push({
            path: `${path}.incomeId`,
            message: 'The referenced income does not exist.',
          })
      }
      if (incomeId === undefined || taxableShare === undefined) return undefined
      return { incomeId, taxableShare }
    },
    errors,
  )
  for (const income of incomes ?? [])
    if (!incomeIds.has(income.id))
      errors.push({
        path: 'taxes.incomes',
        message: `Provide a taxable share for income "${income.id}".`,
      })

  const phaseIds = new Set<string>()
  const phaseRates = collection<PlanTaxPhaseRates>(
    fields.phaseRates,
    'taxes.phaseRates',
    false,
    (value, path, issues) => {
      const item = object(
        value,
        path,
        ['phaseId', ...rateKeys, 'paymentOrder'],
        issues,
      )
      if (!item) return undefined
      const phaseId = text(item.phaseId, `${path}.phaseId`, issues)
      if (phaseId === undefined) return undefined
      if (phaseIds.has(phaseId))
        issues.push({
          path: `${path}.phaseId`,
          message: 'A phase can have only one tax-rate change.',
        })
      phaseIds.add(phaseId)
      if (schedule && !schedule.phases.some((phase) => phase.id === phaseId))
        issues.push({
          path: `${path}.phaseId`,
          message: 'The referenced phase does not exist.',
        })
      const result: PlanTaxPhaseRates = { phaseId }
      if (Object.prototype.hasOwnProperty.call(item, 'paymentOrder')) {
        if (item.paymentOrder === null) result.paymentOrder = null
        else {
          const order = accountOrder(
            item.paymentOrder,
            `${path}.paymentOrder`,
            issues,
            fundingIds,
          )
          if (order !== undefined) result.paymentOrder = order
        }
      }
      for (const key of rateKeys) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          const rate = fraction(item[key], `${path}.${key}`, issues)
          if (rate !== undefined) result[key] = rate
        }
      }
      return result
    },
    errors,
  )
  if (!accounts || !taxIncomes || !phaseRates) return undefined
  return {
    ...rates,
    accounts,
    incomes: taxIncomes,
    phaseRates,
    ...(paymentOrder === undefined ? {} : { paymentOrder }),
  }
}
