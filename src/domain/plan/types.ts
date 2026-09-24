export type PersonId = 'primary' | 'partner'
export type AccountOwner = PersonId | 'joint'
export type AccountKind =
  | 'aggregate'
  | 'savings'
  | 'taxable'
  | 'traditional-401k'
  | 'roth-401k'
  | 'traditional-ira'
  | 'roth-ira'

export type RateAssumption =
  | { kind: 'effective'; annualRate: number }
  | {
      kind: 'nominal'
      annualRate: number
      periodsPerYear: 1 | 2 | 4 | 12 | 365
    }

export type AccountSettings = {
  monthlyContributionCents: number
  monthlyWithdrawalCents: number
  annualFeeRate: number
  rate: RateAssumption
}

export type PlanAccount = {
  id: string
  label: string
  kind: AccountKind
  owner: AccountOwner
  startingBalanceCents: number
  /** Explicit prior calendar Dec 31 closing balance, never inferred from plan start. */
  priorYearEndBalanceCents?: number
  settings: AccountSettings
}

export type AccountChange = {
  accountId: string
  monthlyContributionCents?: number
  monthlyWithdrawalCents?: number
  annualFeeRate?: number
  rate?: RateAssumption
}

export type PlanPhase = {
  id: string
  label: string
  start:
    | { kind: 'plan-start' }
    | { kind: 'age'; person: PersonId; ageMonths: number }
  changes: readonly AccountChange[]
}

export type PlanInput = {
  startMonth: string
  horizonMonths: number
  /** Supported starting-age input range: 0–1800 months, not a longevity prediction. */
  primaryAgeMonths: number
  /** Null means no partner; otherwise the same supported input range as primary. */
  partnerAgeMonths: number | null
  accounts: readonly PlanAccount[]
  phases: readonly PlanPhase[]
}

export type PlanIssue = { path: string; message: string }

export type ResolvedAccount = {
  accountId: string
  settings: AccountSettings
  sources: Record<keyof AccountSettings, string | null>
}

export type CompiledPhase = {
  id: string
  label: string
  startOffsetMonths: number
  /** End-exclusive offset: the next phase's start or the plan horizon. */
  endOffsetMonths: number
  startMonth: string
  endMonthExclusive: string
  primaryAgeMonths: number
  partnerAgeMonths: number | null
  accounts: readonly ResolvedAccount[]
}

export type CompiledPlan = {
  version: 'plan-schedule-1.0.0'
  phases: readonly CompiledPhase[]
  endMonthExclusive: string
}

export type PlanOutcome =
  { ok: true; plan: CompiledPlan } | { ok: false; errors: readonly PlanIssue[] }
