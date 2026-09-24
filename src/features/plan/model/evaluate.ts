import {
  compilePlan,
  type PlanOutcome,
  type PlanIssue,
} from '../../../domain/plan'
import {
  parseMoney,
  parsePercentage,
  type ParsedNumber,
} from '../../../shared/numbers'
import type { PlanDraft, RateDraft } from './draft'

export function parsePlanDraft(draft: PlanDraft) {
  const errors: PlanIssue[] = []
  function parsed(result: ParsedNumber, path: string): number | undefined {
    if (result.ok) return result.value
    errors.push({ path, message: result.error })
    return undefined
  }
  function integer(value: string, path: string): number | undefined {
    if (/^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)))
      return Number(value)
    errors.push({ path, message: 'Enter a whole nonnegative number.' })
    return undefined
  }
  function age(
    years: string,
    months: string,
    path: string,
  ): number | undefined {
    const y = integer(years, path)
    const m = integer(months, path)
    if (m !== undefined && m > 11)
      errors.push({ path, message: 'Age months must be between 0 and 11.' })
    return y === undefined || m === undefined ? undefined : y * 12 + m
  }
  function rate(value: RateDraft, path: string) {
    return {
      kind: value.rateKind,
      annualRate: parsed(
        parsePercentage(value.annualRate),
        `${path}.annualRate`,
      ),
      ...(value.rateKind === 'nominal'
        ? {
            periodsPerYear: integer(
              value.compounding,
              `${path}.periodsPerYear`,
            ),
          }
        : {}),
    }
  }
  function duration(): number | undefined {
    if (!draft.duration) return integer(draft.horizonMonths, 'horizonMonths')
    const years = integer(draft.duration.years, 'duration.years')
    const months = integer(draft.duration.months, 'duration.months')
    if (months !== undefined && months > 11) {
      errors.push({
        path: 'duration.months',
        message: 'Additional months must be between 0 and 11.',
      })
    }
    if (years === undefined || months === undefined) return undefined
    const total = years * 12 + months
    if (!Number.isSafeInteger(total) || total < 1 || total > 1200) {
      errors.push({
        path: 'horizonMonths',
        message: 'Enter a duration from 1 month to 100 years.',
      })
    }
    return total
  }
  const input = {
    startMonth: draft.startMonth.trim(),
    horizonMonths: duration(),
    primaryAgeMonths: age(
      draft.primaryYears,
      draft.primaryMonths,
      'primaryAgeMonths',
    ),
    partnerAgeMonths: draft.partnerEnabled
      ? age(draft.partnerYears, draft.partnerMonths, 'partnerAgeMonths')
      : null,
    accounts: draft.accounts.map((account, index) => {
      const path = `accounts.${index}`
      return {
        id: account.id,
        label: account.label.trim(),
        kind: account.kind,
        owner: account.owner,
        startingBalanceCents: parsed(
          parseMoney(account.balance),
          `${path}.startingBalanceCents`,
        ),
        ...(account.priorYearEndBalance?.trim()
          ? {
              priorYearEndBalanceCents: parsed(
                parseMoney(account.priorYearEndBalance),
                `${path}.priorYearEndBalanceCents`,
              ),
            }
          : {}),
        settings: {
          monthlyContributionCents: parsed(
            parseMoney(account.contribution),
            `${path}.settings.monthlyContributionCents`,
          ),
          monthlyWithdrawalCents: parsed(
            parseMoney(account.withdrawal),
            `${path}.settings.monthlyWithdrawalCents`,
          ),
          annualFeeRate: parsed(
            parsePercentage(account.fee),
            `${path}.settings.annualFeeRate`,
          ),
          rate: rate(account, `${path}.settings.rate`),
        },
      }
    }),
    phases: draft.phases.map((phase, index) => ({
      id: phase.id,
      label: phase.label.trim(),
      start:
        index === 0
          ? { kind: 'plan-start' }
          : {
              kind: 'age',
              person: phase.person,
              ageMonths: age(
                phase.years,
                phase.months,
                `phases.${index}.start.ageMonths`,
              ),
            },
      changes: Object.entries(phase.changes)
        .filter(([, change]) =>
          Object.values(change).some((value) => value !== null),
        )
        .map(([accountId, change], changeIndex) => {
          const path = `phases.${index}.changes.${changeIndex}`
          return {
            accountId,
            ...(change.contribution !== null
              ? {
                  monthlyContributionCents: parsed(
                    parseMoney(change.contribution),
                    `${path}.monthlyContributionCents`,
                  ),
                }
              : {}),
            ...(change.withdrawal !== null
              ? {
                  monthlyWithdrawalCents: parsed(
                    parseMoney(change.withdrawal),
                    `${path}.monthlyWithdrawalCents`,
                  ),
                }
              : {}),
            ...(change.fee !== null
              ? {
                  annualFeeRate: parsed(
                    parsePercentage(change.fee),
                    `${path}.annualFeeRate`,
                  ),
                }
              : {}),
            ...(change.rate !== null
              ? { rate: rate(change.rate, `${path}.rate`) }
              : {}),
          }
        }),
    })),
  }
  if (!draft.label.trim())
    errors.push({ path: 'label', message: 'Enter a plan name.' })
  return errors.length
    ? { ok: false as const, errors }
    : { ok: true as const, input }
}

export function evaluatePlan(draft: PlanDraft): PlanOutcome {
  const parsed = parsePlanDraft(draft)
  return parsed.ok ? compilePlan(parsed.input) : parsed
}
