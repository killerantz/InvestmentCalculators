import { describe, expect, it } from 'vitest'
import { createExamplePlan } from './draft'
import { evaluatePlan } from './evaluate'
import { planAges } from './planAges'
import { scheduleView } from './scheduleView'

function example(partnerEnabled = true) {
  const draft = createExamplePlan()
  draft.phases = draft.phases.slice(0, 1)
  draft.primaryYears = '42'
  draft.primaryMonths = '8'
  draft.partnerEnabled = partnerEnabled
  draft.partnerYears = '39'
  draft.partnerMonths = '11'
  draft.duration = { years: '3', months: '7' }
  const outcome = evaluatePlan(draft)
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
  return { draft, plan: outcome.plan }
}

describe('plan age presentation', () => {
  it('calculates exact start, end and rollover ages from the compiled household clock', () => {
    const { plan } = example()
    const ages = planAges(plan)
    expect(ages.at(0)).toEqual({ primary: '42y 8m', partner: '39y 11m' })
    expect(ages.at(1)).toEqual({ primary: '42y 9m', partner: '40y 0m' })
    expect(ages.columns).toEqual(['Age (primary, partner)'])
    expect(ages.ledgerAge(0)).toBe('42y 8m, 39y 11m')
    expect(ages.ledgerAge(12)).toBe('43y 8m, 40y 11m')
    expect(ages.endSummary).toBe(
      'Plan ends 2029-08: primary age 46y 3m; partner age 43y 6m.',
    )
  })
  it('reports phase end ages at the exclusive boundary, matching the plan end', () => {
    const { draft, plan } = example()
    const view = scheduleView(plan, draft)
    expect(view.phaseRows[0]?.cells.slice(4)).toEqual([
      '42y 8m, 39y 11m',
      '46y 3m, 43y 6m',
    ])
    expect(view.phaseColumns.slice(4)).toEqual([
      'Start ages (primary, partner)',
      'End ages (primary, partner)',
    ])
    expect(view.phaseRows[0]?.cells).toHaveLength(view.phaseColumns.length)
    expect(view.planEndSummary).toBe(planAges(plan).endSummary)
  })
  it('combines boundary ages consistently across consecutive phases with and without a partner', () => {
    for (const partner of [true, false]) {
      const { draft } = example(partner)
      draft.phases.push({
        id: 'later',
        label: 'Later phase',
        person: 'primary',
        years: '44',
        months: '0',
        changes: {},
      })
      const result = evaluatePlan(draft)
      if (!result.ok) throw new Error(JSON.stringify(result.errors))
      const view = scheduleView(result.plan, draft)
      expect(view.phaseRows[0]?.cells[5]).toBe(view.phaseRows[1]?.cells[4])
      expect(view.phaseRows[1]?.cells[5]).toBe(
        partner ? '46y 3m, 43y 6m' : '46y 3m',
      )
      expect(view.phaseColumns.slice(4)).toEqual(
        partner
          ? ['Start ages (primary, partner)', 'End ages (primary, partner)']
          : ['Start age (primary)', 'End age (primary)'],
      )
      for (const row of view.phaseRows) expect(row.cells).toHaveLength(6)
    }
  })
  it('omits partner ledger ages when no partner is included', () => {
    const { plan } = example(false)
    const ages = planAges(plan)
    expect(ages.columns).toEqual(['Age (primary)'])
    expect(ages.ledgerAge(36)).toBe('45y 8m')
    expect(ages.at(43).partner).toBeNull()
    expect(ages.endSummary).not.toContain('partner')
  })
  it('reports invalid age offsets explicitly', () => {
    const { plan } = example()
    const ages = planAges(plan)
    for (const offset of [-1, 1.5, NaN, Infinity]) {
      expect(() => ages.at(offset)).toThrow(/Age offsets/)
      expect(() => ages.ledgerAge(offset)).toThrow(/Age offsets/)
    }
  })
})
