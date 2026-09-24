import { describe, expect, it } from 'vitest'
import { createExamplePlan } from './draft'
import { groupEditorIssues } from './editorValidation'

describe('cross-section validation navigation', () => {
  it('groups every issue under its editing tab with account and phase context', () => {
    const groups = groupEditorIssues(
      [
        { path: 'duration.years', message: 'Enter a whole number.' },
        {
          path: 'accounts.1.owner',
          message: 'Joint ownership is not supported.',
        },
        {
          path: 'phases.2.start.ageMonths',
          message: 'Start must be before the horizon.',
        },
        {
          path: 'phases.1.changes.0.monthlyContributionCents',
          message: 'Enter nonnegative dollars.',
        },
      ],
      createExamplePlan(),
    )
    expect(groups.map((group) => [group.value, group.issues.length])).toEqual([
      ['household', 1],
      ['accounts', 1],
      ['phases', 2],
    ])
    expect(groups[1]?.issues[0]).toContain(
      'Account 2: Workplace savings - Owner',
    )
    expect(groups[2]?.issues[0]).toContain(
      'Phase 3: Retirement bridge - Start age',
    )
    expect(groups[2]?.issues[1]).toContain(
      'Phase 2: Savings step-up - Monthly contribution',
    )
  })

  it('removes resolved sections while retaining outstanding issues', () => {
    expect(groupEditorIssues([], createExamplePlan())).toEqual([])
    const groups = groupEditorIssues(
      [
        {
          path: 'accounts',
          message: 'Combined portfolios cannot be mixed with accounts.',
        },
      ],
      createExamplePlan(),
    )
    expect(groups.map((group) => group.value)).toEqual(['accounts'])
    expect(groups[0]?.issues[0]).toContain('Combined portfolios')
  })
})
