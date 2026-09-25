import type { PlanIssue } from '../../../domain/plan'
import { parseMoney, parsePercentage } from '../../../shared/numbers'
import type { PlanDraft } from './draft'

export type TaxRateDraft = {
  ordinaryRate: string
  capitalGainsRate: string
  qualifiedDividendRate: string
}
export type AccountTaxDraft = {
  costBasis: string
  dividendYield: string
  qualifiedShare: string
}
export type TaxPhaseDraft = Partial<TaxRateDraft> & {
  paymentOrder?: string[] | null
}
export type TaxDraft = TaxRateDraft & {
  enabled: boolean
  paymentOrder?: string[]
  accounts: Record<string, AccountTaxDraft>
  incomeShares: Record<string, string>
  phaseRates: Record<string, TaxPhaseDraft>
}

export function newTaxDraft(): TaxDraft {
  return {
    enabled: false,
    ordinaryRate: '',
    capitalGainsRate: '',
    qualifiedDividendRate: '',
    accounts: {},
    incomeShares: {},
    phaseRates: {},
  }
}

export function accountTaxDraft(): AccountTaxDraft {
  return { costBasis: '', dividendYield: '0', qualifiedShare: '0' }
}

export function inheritedTaxRates(
  plan: PlanDraft,
  beforePhase: number,
): TaxRateDraft {
  const taxes = plan.taxes ?? newTaxDraft()
  const rates: TaxRateDraft = {
    ordinaryRate: taxes.ordinaryRate,
    capitalGainsRate: taxes.capitalGainsRate,
    qualifiedDividendRate: taxes.qualifiedDividendRate,
  }
  for (const phase of plan.phases.slice(0, beforePhase))
    for (const key of [
      'ordinaryRate',
      'capitalGainsRate',
      'qualifiedDividendRate',
    ] as const) {
      const value = taxes.phaseRates[phase.id]?.[key]
      if (value !== undefined) rates[key] = value
    }
  return rates
}

export function inheritedTaxPaymentOrder(
  plan: PlanDraft,
  beforePhase: number,
): readonly string[] | null {
  let order: readonly string[] | null = plan.taxes?.paymentOrder ?? null
  for (const phase of plan.phases.slice(0, beforePhase)) {
    const override = plan.taxes?.phaseRates[phase.id]?.paymentOrder
    if (override !== undefined) order = override
  }
  return order
}

export function parseTaxDraft(plan: PlanDraft, errors: PlanIssue[]) {
  const taxes = plan.taxes
  if (!taxes?.enabled) return undefined
  function read(value: string, path: string, money = false, maximum = 1) {
    const parsed = money ? parseMoney(value) : parsePercentage(value)
    if (parsed.ok) {
      if (!money && (parsed.value < 0 || parsed.value > maximum)) {
        errors.push({
          path,
          message: `Enter a percentage from 0 to ${maximum * 100}.`,
        })
        return undefined
      }
      return parsed.value
    }
    errors.push({ path, message: parsed.error })
    return undefined
  }
  return {
    ...(taxes.paymentOrder === undefined
      ? {}
      : { paymentOrder: [...taxes.paymentOrder] }),
    ordinaryRate: read(taxes.ordinaryRate, 'taxes.ordinaryRate'),
    capitalGainsRate: read(taxes.capitalGainsRate, 'taxes.capitalGainsRate'),
    qualifiedDividendRate: read(
      taxes.qualifiedDividendRate,
      'taxes.qualifiedDividendRate',
    ),
    accounts: plan.accounts
      .filter((account) => account.kind === 'taxable')
      .map((account, index) => {
        const values = taxes.accounts[account.id] ?? accountTaxDraft()
        const path = `taxes.accounts.${index}`
        return {
          accountId: account.id,
          costBasisCents: read(
            values.costBasis,
            `${path}.costBasisCents`,
            true,
          ),
          annualDividendYield: read(
            values.dividendYield,
            `${path}.annualDividendYield`,
          ),
          qualifiedDividendShare: read(
            values.qualifiedShare,
            `${path}.qualifiedDividendShare`,
          ),
        }
      }),
    incomes: (plan.finance?.incomes ?? []).map((income, index) => ({
      incomeId: income.id,
      taxableShare: read(
        taxes.incomeShares[income.id] ??
          (income.kind === 'pension' ? '100' : ''),
        `taxes.incomes.${index}.taxableShare`,
        false,
        income.kind === 'social-security' ? 0.85 : 1,
      ),
    })),
    phaseRates: plan.phases
      .filter(
        (phase) => Object.keys(taxes.phaseRates[phase.id] ?? {}).length > 0,
      )
      .map((phase, index) => {
        const rates = taxes.phaseRates[phase.id]!
        return {
          phaseId: phase.id,
          ...(rates.paymentOrder === undefined
            ? {}
            : {
                paymentOrder:
                  rates.paymentOrder === null ? null : [...rates.paymentOrder],
              }),
          ...(rates.ordinaryRate === undefined
            ? {}
            : {
                ordinaryRate: read(
                  rates.ordinaryRate,
                  `taxes.phaseRates.${index}.ordinaryRate`,
                ),
              }),
          ...(rates.capitalGainsRate === undefined
            ? {}
            : {
                capitalGainsRate: read(
                  rates.capitalGainsRate,
                  `taxes.phaseRates.${index}.capitalGainsRate`,
                ),
              }),
          ...(rates.qualifiedDividendRate === undefined
            ? {}
            : {
                qualifiedDividendRate: read(
                  rates.qualifiedDividendRate,
                  `taxes.phaseRates.${index}.qualifiedDividendRate`,
                ),
              }),
        }
      }),
  }
}
