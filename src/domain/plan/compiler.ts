import type {
  AccountSettings,
  CompiledPhase,
  PlanIssue,
  PlanOutcome,
  ResolvedAccount,
} from './types'
import { monthIndex, parsePlan, resolveOffsets } from './validation'

function monthString(index: number): string {
  const year = Math.floor(index / 12) + 1
  const month = (index % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

function copySettings(settings: AccountSettings): AccountSettings {
  return { ...settings, rate: { ...settings.rate } }
}

/**
 * Compile an ordered, end-exclusive schedule, not a financial projection.
 * Omitted changes inherit; supplied zero values override; rates replace as a whole.
 * All resolved settings, rates and sources are independent snapshots.
 */
export function compilePlan(input: unknown): PlanOutcome {
  const errors: PlanIssue[] = []
  const parsed = parsePlan(input, errors)
  if (!parsed) return { ok: false, errors }
  const offsets = resolveOffsets(parsed, errors)
  if (errors.length > 0) return { ok: false, errors }

  const accounts = new Map<string, ResolvedAccount>()
  for (const account of parsed.accounts) {
    accounts.set(account.id, {
      accountId: account.id,
      settings: copySettings(account.settings),
      sources: {
        monthlyContributionCents: null,
        monthlyWithdrawalCents: null,
        annualFeeRate: null,
        rate: null,
      },
    })
  }
  const startMonthIndex = monthIndex(parsed.startMonth)
  const phases: CompiledPhase[] = parsed.phases.map((phase, index) => {
    for (const change of phase.changes) {
      const account = accounts.get(change.accountId)
      if (!account)
        throw new Error('Validated account reference was not resolved.')
      for (const key of [
        'monthlyContributionCents',
        'monthlyWithdrawalCents',
        'annualFeeRate',
      ] as const) {
        const value = change[key]
        if (value !== undefined) {
          account.settings[key] = value
          account.sources[key] = phase.id
        }
      }
      if (change.rate !== undefined) {
        account.settings.rate = { ...change.rate }
        account.sources.rate = phase.id
      }
    }
    const startOffsetMonths = offsets[index]
    if (startOffsetMonths === undefined)
      throw new Error('Validated phase offset was not resolved.')
    const endOffsetMonths = offsets[index + 1] ?? parsed.horizonMonths
    return {
      id: phase.id,
      label: phase.label,
      startOffsetMonths,
      endOffsetMonths,
      startMonth: monthString(startMonthIndex + startOffsetMonths),
      endMonthExclusive: monthString(startMonthIndex + endOffsetMonths),
      primaryAgeMonths: parsed.primaryAgeMonths + startOffsetMonths,
      partnerAgeMonths:
        parsed.partnerAgeMonths === null
          ? null
          : parsed.partnerAgeMonths + startOffsetMonths,
      accounts: Array.from(accounts.values(), (account) => ({
        accountId: account.accountId,
        settings: copySettings(account.settings),
        sources: { ...account.sources },
      })),
    }
  })
  return {
    ok: true,
    plan: {
      version: 'plan-schedule-1.0.0',
      phases,
      endMonthExclusive: monthString(startMonthIndex + parsed.horizonMonths),
    },
  }
}
