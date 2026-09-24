import { describe, expect, it } from 'vitest'
import { createExamplePlan, emptyChange } from './draft'
import { evaluatePlan } from './evaluate'
import { scheduleView } from './scheduleView'

describe('plan draft evaluation', () => {
  it.each([
    ['40', '0', 480],
    ['40', '6', 486],
    ['100', '0', 1200],
    ['0', '1', 1],
  ])('compiles %s years and %s months to %i months', (years, months, total) => {
    const draft = createExamplePlan()
    draft.phases = draft.phases.slice(0, 1)
    draft.duration = { years, months }
    const outcome = evaluatePlan(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const view = scheduleView(outcome.plan, draft)
    expect(view.total).toBe(total)
    expect(view.phaseRows[0]?.cells[0]).toBe('1. Accumulation')
    expect(view.phaseRows[0]?.cells[3]).toBe(`${years}y ${months}m`)
    expect(view.timeline[0]?.label).toBe('Phase 1: Accumulation')
  })

  it.each([
    ['', '0'],
    ['-1', '0'],
    ['1.5', '0'],
    ['0', '0'],
    ['100', '1'],
    ['101', '0'],
    ['1', '12'],
    ['1', ''],
    ['1', '1.5'],
    ['9007199254740991', '0'],
  ])('rejects invalid duration %j years and %j months', (years, months) => {
    const draft = createExamplePlan()
    draft.duration = { years, months }
    expect(evaluatePlan(draft).ok).toBe(false)
  })

  it('builds an ordered calendar schedule with inherited sources', () => {
    const draft = createExamplePlan()
    const outcome = evaluatePlan(draft)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('Example plan must compile.')
    expect(outcome.plan.phases.map((phase) => phase.startMonth)).toEqual([
      '2026-01',
      '2036-01',
      '2046-01',
    ])
    const view = scheduleView(outcome.plan, draft)
    expect(view.end).toBe('2066-01')
    expect(view.phases[2]?.rows[1]?.cells[1]).toBe('$0.00 / Retirement bridge')
    expect(view.phases[1]?.rows[0]?.cells[1]).toBe('$100.00 / Account default')
  })

  it('converts different household ages including half years on one clock', () => {
    const draft = createExamplePlan()
    draft.partnerEnabled = true
    const phase = draft.phases[1]
    if (!phase) throw new Error('Fixture requires a second phase.')
    phase.person = 'partner'
    phase.years = '47'
    phase.months = '6'
    const outcome = evaluatePlan(draft)
    if (!outcome.ok) throw new Error('Valid partner anchor rejected.')
    expect(outcome.plan.phases[1]).toMatchObject({
      startOffsetMonths: 114,
      primaryAgeMonths: 594,
      partnerAgeMonths: 570,
    })
  })

  it.each(['', '1,000', '-1', '1.001'])(
    'rejects invalid money %j without coercing it to zero',
    (balance) => {
      const draft = createExamplePlan()
      draft.accounts[0]!.balance = balance
      expect(evaluatePlan(draft)).toMatchObject({
        ok: false,
        errors: [{ path: 'accounts.0.startingBalanceCents' }],
      })
    },
  )

  it.each(['', '1.5', '-1', '12'])(
    'rejects invalid additional age months %j',
    (value) => {
      const draft = createExamplePlan()
      draft.primaryMonths = value
      expect(evaluatePlan(draft)).toMatchObject({
        ok: false,
        errors: [{ path: 'primaryAgeMonths' }],
      })
    },
  )

  it('ignores inactive nominal frequency and preserves explicit zero overrides', () => {
    const draft = createExamplePlan()
    draft.accounts[0]!.compounding = ''
    draft.phases[1]!.changes.cash = { ...emptyChange(), contribution: '0' }
    const outcome = evaluatePlan(draft)
    if (!outcome.ok) throw new Error('Valid zero override rejected.')
    expect(
      outcome.plan.phases[2]?.accounts[0]?.settings.monthlyContributionCents,
    ).toBe(0)
    expect(
      outcome.plan.phases[2]?.accounts[0]?.sources.monthlyContributionCents,
    ).toBe('step-up')
  })

  it('does not hide partner references when the partner is disabled', () => {
    const draft = createExamplePlan()
    draft.accounts[0]!.owner = 'partner'
    draft.phases[1]!.person = 'partner'
    const outcome = evaluatePlan(draft)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('Invalid partner references accepted.')
    expect(
      outcome.errors.some((error) => error.path.startsWith('accounts.0')),
    ).toBe(true)
    expect(
      outcome.errors.some((error) => error.path.startsWith('phases.1')),
    ).toBe(true)
  })

  it('rejects aggregate mixing and invalid order instead of sorting or merging', () => {
    const draft = createExamplePlan()
    draft.accounts[0]!.kind = 'aggregate'
    draft.phases[1]!.years = '65'
    const original = structuredClone(draft)
    expect(evaluatePlan(draft).ok).toBe(false)
    expect(draft).toEqual(original)
  })

  it('requires an explicit nominal compounding frequency and finite percentage', () => {
    const draft = createExamplePlan()
    draft.accounts[0]!.rateKind = 'nominal'
    draft.accounts[0]!.compounding = ''
    draft.accounts[0]!.annualRate = 'Infinity'
    const result = evaluatePlan(draft)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Invalid rate accepted.')
    expect(result.errors.map((error) => error.path)).toEqual([
      'accounts.0.settings.rate.annualRate',
      'accounts.0.settings.rate.periodsPerYear',
    ])
  })
})
