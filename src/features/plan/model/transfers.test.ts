import { describe, expect, it } from 'vitest'
import {
  copyPlan,
  createExamplePlan,
  newAccount,
  removeAccount,
  removePhase,
} from './draft'
import { evaluateProjection } from './evaluateProjection'
import { groupEditorIssues } from './editorValidation'
import { planReportView, type ReportOptions } from './planReportView'
import { transferEditor } from './transferEditor'
import { scheduleView } from './scheduleView'

function example() {
  const draft = createExamplePlan()
  draft.horizonMonths = '25'
  draft.phases[1]!.years = '41'
  draft.phases[1]!.changes = {}
  draft.phases[2]!.years = '42'
  for (const account of draft.accounts) {
    account.balance = '1000'
    account.annualRate = '0'
    account.contribution = '0'
  }
  draft.accounts.push({
    ...newAccount('roth'),
    kind: 'roth-ira',
    label: 'Example Roth',
    annualRate: '0',
  })
  draft.finance!.transfers = [
    {
      id: 'conversion',
      phaseId: 'step-up',
      kind: 'roth-conversion',
      sourceAccountId: 'workplace',
      destinationAccountId: 'roth',
      amount: '100',
    },
  ]
  return draft
}
const options: ReportOptions = {
  interval: 'annual',
  year: 2,
  hiddenSeries: [],
  timeUnit: 'years',
  metric: 'closing',
  basis: 'nominal',
  realColumns: false,
}

describe('account transfer entry and reporting', () => {
  it('moves existing money only within the selected phase and reports unfilled amounts', () => {
    const draft = example()
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    const projection = result.projection
    const schedule = scheduleView(projection.schedule, draft)
    expect(schedule.phases.map((phase) => phase.transfers.length)).toEqual([
      0, 1, 0,
    ])
    expect(schedule.phases[1]?.transfers[0]?.cells).toEqual([
      'Transfer 1',
      'Roth conversion',
      'Workplace savings',
      'Example Roth',
      '$100 monthly',
    ])
    expect(projection.monthly[11]?.transfersOutCents).toBe(0)
    expect(projection.monthly[12]?.transfersOutCents).toBe(10000)
    expect(projection.monthly[24]?.transfersOutCents).toBe(0)
    expect(projection.totals).toMatchObject({
      openingBalanceCents: 200000,
      closingBalanceCents: 200000,
      externalContributionsCents: 0,
      incomeCents: 0,
      transfersOutCents: 100000,
      transfersInCents: 100000,
      rothConversionsOutCents: 100000,
      transferShortfallCents: 20000,
    })
    for (const interval of ['annual', 'monthly'] as const) {
      const view = planReportView(projection, draft, { ...options, interval })
      expect(view.hasTransferShortfall).toBe(true)
      expect(view.transferRows[0]?.cells).toEqual([
        'Transfer 1',
        'Savings step-up only',
        'Roth conversion',
        'Workplace savings',
        'Example Roth',
        '$100 monthly',
        '$1,200.00',
        '$1,000.00',
        '$200.00',
      ])
      const expected = interval === 'annual' ? '$1,000.00' : '$100.00'
      const transferIndex = view.columns.indexOf('Account transfers out ($)')
      expect(
        view.ledger[interval === 'annual' ? 1 : 0]?.cells[transferIndex],
      ).toBe(expected)
      const outIndex = view.accountColumns.indexOf('Account transfers out ($)')
      const inIndex = view.accountColumns.indexOf('Account transfers in ($)')
      expect(
        view.accountLedgers[1]?.rows[interval === 'annual' ? 1 : 0]?.cells[
          outIndex
        ],
      ).toBe(expected)
      expect(
        view.accountLedgers[2]?.rows[interval === 'annual' ? 1 : 0]?.cells[
          inIndex
        ],
      ).toBe(expected)
      for (const row of view.ledger)
        expect(row.cells).toHaveLength(view.columns.length)
      for (const account of view.accountLedgers)
        for (const row of account.rows)
          expect(row.cells).toHaveLength(view.accountColumns.length)
    }
  })
  it.each(['', '-1', '1,000', '0.001'])(
    'routes invalid transfer amount %j to its field and section',
    (amount) => {
      const draft = example()
      draft.finance!.transfers![0]!.amount = amount
      const result = evaluateProjection(draft)
      if (result.ok) throw new Error('Invalid money must be rejected.')
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'transfers.0.monthlyAmountCents' }),
      )
      const groups = groupEditorIssues(result.errors, draft)
      expect(groups[0]?.value).toBe('transfers')
      expect(groups[0]?.issues[0]).toContain('Transfer 1')
      const editor = transferEditor(
        draft,
        () => {},
        result.errors,
        () => {},
      )
      expect(
        editor[0]?.fields.find((field) => field.id === 'monthlyAmountCents')
          ?.error,
      ).toBeTruthy()
    },
  )
  it('never rewrites contribution entries and validates deliberate source and destination choices', () => {
    const draft = example()
    draft.accounts[2]!.contribution = '250'
    draft.finance!.transfers![0]!.sourceAccountId = ''
    const result = evaluateProjection(draft)
    expect(result.ok).toBe(false)
    expect(draft.accounts[2]!.contribution).toBe('250')
  })
  it('edits, reorders and requests removal without mutating other plan copies', () => {
    const draft = example()
    draft.finance!.transfers!.push({
      ...draft.finance!.transfers![0]!,
      id: 'second',
      amount: '50',
    })
    const original = copyPlan(draft, 'original')
    let removed = ''
    const getEditor = () =>
      transferEditor(
        draft,
        (edit) => edit(draft),
        [],
        (entry) => {
          removed = entry.id
        },
      )
    const editor = getEditor()
    editor[0]!.fields
      .find((field) => field.id === 'monthlyAmountCents')!
      .onChange('75')
    expect(draft.finance!.transfers![0]!.amount).toBe('75')
    expect(original.finance!.transfers![0]!.amount).toBe('100')
    editor[0]!.later()
    expect(draft.finance!.transfers!.map((entry) => entry.id)).toEqual([
      'second',
      'conversion',
    ])
    getEditor()[1]!.earlier()
    expect(draft.finance!.transfers![0]!.id).toBe('conversion')
    getEditor()[0]!.remove()
    expect(removed).toBe('conversion')
    expect(draft.finance!.transfers).toHaveLength(2)
    expect(() => getEditor()[0]!.earlier()).toThrow()
  })
  it('removes transfers referencing deleted accounts or phases, without affecting copies', () => {
    const draft = example()
    const copy = copyPlan(draft, 'copy')
    removeAccount(draft, 'roth')
    expect(draft.finance!.transfers).toEqual([])
    expect(copy.finance!.transfers).toHaveLength(1)
    removePhase(copy, 'step-up')
    expect(copy.finance!.transfers).toEqual([])
  })
})
