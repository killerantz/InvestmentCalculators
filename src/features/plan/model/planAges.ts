import type { CompiledPlan } from '../../../domain/plan'

export const formatAge = (months: number) =>
  `${Math.floor(months / 12)}y ${months % 12}m`

export function planAges(plan: CompiledPlan) {
  const first = plan.phases[0]
  const last = plan.phases.at(-1)
  if (!first || !last)
    throw new Error('A compiled plan requires phases to calculate ages.')
  const hasPartner = first.partnerAgeMonths !== null
  const at = (offset: number) => {
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error('Age offsets must be whole nonnegative months.')
    return {
      primary: formatAge(first.primaryAgeMonths + offset),
      partner:
        first.partnerAgeMonths === null
          ? null
          : formatAge(first.partnerAgeMonths + offset),
    }
  }
  const describe = (offset: number) => {
    const ages = at(offset)
    return `primary age ${ages.primary}${ages.partner === null ? '' : `; partner age ${ages.partner}`}`
  }
  const ledgerAge = (offset: number) => {
    const ages = at(offset)
    return ages.partner === null
      ? ages.primary
      : `${ages.primary}, ${ages.partner}`
  }
  return {
    at,
    describe,
    ledgerAge,
    columns: [hasPartner ? 'Age (primary, partner)' : 'Age (primary)'],
    endSummary: `Plan ends ${plan.endMonthExclusive}: ${describe(last.endOffsetMonths)}.`,
  }
}
