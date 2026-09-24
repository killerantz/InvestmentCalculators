import { describe, expect, it } from 'vitest'
import {
  createExamplePlan,
  copyPlan,
  inheritedSettings,
  hasAccountChanges,
  removeAccount,
  removePhase,
  durationDraft,
} from './draft'

describe('editable plan instructions', () => {
  it('presents existing month-based drafts as years without rewriting them', () => {
    const plan = createExamplePlan()
    plan.horizonMonths = '485'
    const before = structuredClone(plan)
    expect(durationDraft(plan)).toEqual({ years: '40', months: '5' })
    expect(plan).toEqual(before)
    plan.duration = { years: '', months: '5' }
    expect(durationDraft(plan)).toEqual({ years: '', months: '5' })
  })

  it('keeps edited year-duration drafts independent when copied', () => {
    const plan = createExamplePlan()
    plan.duration = { years: '40', months: '6' }
    const copy = copyPlan(plan, 'copy')
    if (!copy.duration) throw new Error('Copy must retain the duration draft.')
    copy.duration.years = '50'
    expect(durationDraft(plan)).toEqual({ years: '40', months: '6' })
    expect(durationDraft(copy)).toEqual({ years: '50', months: '6' })
  })
  it('removes account references together and leaves independent copies untouched', () => {
    const original = createExamplePlan()
    const copy = copyPlan(original, 'copy')
    removeAccount(copy, 'workplace')
    expect(copy.accounts.map((account) => account.id)).toEqual(['cash'])
    expect(hasAccountChanges(copy, 'workplace')).toBe(false)
    expect(hasAccountChanges(original, 'workplace')).toBe(true)
    expect(() => removeAccount(copy, 'cash')).toThrow(/multi-account/)
  })

  it('removes a phase without preserving its instructions as hidden defaults', () => {
    const draft = createExamplePlan()
    removePhase(draft, 'step-up')
    expect(inheritedSettings(draft, 1, 'workplace').contribution).toBe('500')
    expect(() => removePhase(draft, 'start')).toThrow(/planning start/)
  })
  it('carries zero overrides forward without modifying account defaults', () => {
    const draft = createExamplePlan()
    const account = draft.accounts[0]
    const phase = draft.phases[1]
    if (!account || !phase) throw new Error('Synthetic fixtures required.')
    phase.changes[account.id] = {
      contribution: '0',
      withdrawal: null,
      fee: null,
      rate: null,
    }
    expect(inheritedSettings(draft, 2, account.id).contribution).toBe('0')
    expect(account.contribution).toBe('100')
    phase.changes[account.id] = {
      contribution: null,
      withdrawal: null,
      fee: null,
      rate: null,
    }
    expect(inheritedSettings(draft, 2, account.id).contribution).toBe('100')
  })

  it('replaces complete rate instructions and preserves independent copies', () => {
    const original = createExamplePlan()
    const copy = copyPlan(original, 'copy')
    const phase = copy.phases[1]
    if (!phase) throw new Error('A second phase is required.')
    phase.changes.cash = {
      contribution: null,
      withdrawal: null,
      fee: null,
      rate: { rateKind: 'nominal', annualRate: '4.25', compounding: '365' },
    }
    expect(inheritedSettings(copy, 2, 'cash')).toMatchObject({
      rateKind: 'nominal',
      annualRate: '4.25',
      compounding: '365',
    })
    expect(inheritedSettings(original, 2, 'cash').annualRate).toBe('3')
    expect(copy.id).toBe('copy')
    expect(copy.phases[0]?.id).toBe(original.phases[0]?.id)
  })

  it('detects meaningful references, not cleared override controls', () => {
    const plan = createExamplePlan()
    expect(hasAccountChanges(plan, 'workplace')).toBe(true)
    expect(hasAccountChanges(plan, 'cash')).toBe(false)
    const phase = plan.phases[1]
    if (!phase) throw new Error('A second phase is required.')
    phase.changes.cash = {
      contribution: null,
      withdrawal: null,
      fee: null,
      rate: null,
    }
    expect(hasAccountChanges(plan, 'cash')).toBe(false)
    expect(() => inheritedSettings(plan, 0, 'missing')).toThrow(/account/)
  })
})
