import { describe, expect, it } from 'vitest'
import { copyPlan, createExamplePlan } from './draft'
import { evaluateProjection } from './evaluateProjection'
import { groupEditorIssues } from './editorValidation'
import { planReportView, type ReportOptions } from './planReportView'
import { scheduleView } from './scheduleView'
import { transferEditor } from './transferEditor'

function example() {
  const draft = createExamplePlan()
  draft.startMonth = '2026-07'
  draft.horizonMonths = '18'
  draft.phases = draft.phases.slice(0, 1)
  for (const account of draft.accounts) {
    account.annualRate = '0'
    account.contribution = '0'
    account.balance = account.id === 'workplace' ? '120000' : '0'
  }
  draft.accounts[1]!.priorYearEndBalance = '100000'
  draft.finance!.transfers = [
    {
      id: 'distribution',
      phaseId: 'start',
      kind: 'transfer',
      sourceAccountId: 'workplace',
      destinationAccountId: 'cash',
      amount: 'invalid inactive dollar draft',
      amountKind: 'annual-percentage',
      annualPercentage: '12',
    },
  ]
  return draft
}
const options: ReportOptions = {
  interval: 'annual',
  year: 1,
  hiddenSeries: [],
  timeUnit: 'years',
  metric: 'closing',
  basis: 'nominal',
  realColumns: false,
}

describe('annual percentage transfer presentation', () => {
  it('uses explicit prior December balance, resets in January, and audits calendar rather than projection years', () => {
    const draft = example()
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    const projection = result.projection
    expect(projection.monthly[0]?.transfers[0]).toMatchObject({
      requestedCents: 100000,
      referenceBalanceCents: 10000000,
      annualRequestedCents: 1200000,
    })
    expect(projection.monthly[6]?.transfers[0]).toMatchObject({
      requestedCents: 114000,
      referenceBalanceCents: 11400000,
      annualRequestedCents: 1368000,
    })
    expect(projection.totals).toMatchObject({
      openingBalanceCents: 12000000,
      closingBalanceCents: 12000000,
      transfersOutCents: 1968000,
      transfersInCents: 1968000,
      externalContributionsCents: 0,
      incomeCents: 0,
    })
    expect(projection.annual[0]?.transfersOutCents).toBe(1284000)
    const view = planReportView(projection, draft, options)
    const instruction =
      '12% of prior December 31 balance per year; paid monthly'
    expect(view.transferRows[0]?.cells).toContain(instruction)
    expect(
      scheduleView(projection.schedule, draft).phases[0]?.transfers[0]?.cells,
    ).toContain(instruction)
    expect(view.percentageTransferRows.map((row) => row.cells)).toEqual([
      [
        'Transfer 1',
        'Accumulation only',
        '2026',
        'Workplace savings',
        '2025-12-31',
        'Entered prior year-end balance',
        '$100,000.00',
        '12%',
        '$12,000.00',
        '$6,000.00',
        '$6,000.00',
        '$0.00',
      ],
      [
        'Transfer 1',
        'Accumulation only',
        '2027',
        'Workplace savings',
        '2026-12-31',
        'Projected December closing balance',
        '$114,000.00',
        '12%',
        '$13,680.00',
        '$13,680.00',
        '$13,680.00',
        '$0.00',
      ],
    ])
  })
  it('requires the first calendar-year reference without substituting starting funds', () => {
    const draft = example()
    delete draft.accounts[1]!.priorYearEndBalance
    const result = evaluateProjection(draft)
    if (result.ok) throw new Error('Missing reference balance must fail.')
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'accounts.1.priorYearEndBalanceCents' }),
    )
    expect(groupEditorIssues(result.errors, draft)[0]).toMatchObject({
      value: 'accounts',
    })
    expect(
      groupEditorIssues(result.errors, draft)[0]?.issues.join(' '),
    ).toContain('Prior year-end balance')
  })
  it('does not require a historical entry when the transfer first starts in a later calendar year', () => {
    const draft = example()
    delete draft.accounts[1]!.priorYearEndBalance
    draft.phases.push({
      id: 'later',
      label: 'Later distribution',
      person: 'primary',
      years: '40',
      months: '6',
      changes: {},
    })
    draft.finance!.transfers![0]!.phaseId = 'later'
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.monthly[5]?.transfersOutCents).toBe(0)
    expect(result.projection.monthly[6]?.transfers[0]).toMatchObject({
      referenceBalanceCents: 12000000,
      requestedCents: 120000,
    })
  })
  it('preserves explicit zero references and percentage requests', () => {
    const draft = example()
    draft.accounts[1]!.priorYearEndBalance = '0'
    draft.finance!.transfers![0]!.annualPercentage = '0'
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.monthly[0]?.transfers[0]).toMatchObject({
      referenceBalanceCents: 0,
      annualRequestedCents: 0,
      requestedCents: 0,
    })
    expect(
      planReportView(result.projection, draft, options).percentageTransferRows,
    ).toHaveLength(2)
  })
  it.each(['', '-1', 'not a percentage', '1,000'])(
    'rejects invalid percentage %j with a transfer field error',
    (value) => {
      const draft = example()
      draft.finance!.transfers![0]!.annualPercentage = value
      const result = evaluateProjection(draft)
      if (result.ok) throw new Error('Invalid percentage must fail.')
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'transfers.0.annualRate' }),
      )
      const editor = transferEditor(
        draft,
        () => {},
        result.errors,
        () => {},
      )
      expect(
        editor[0]?.fields.find((field) => field.id === 'annualRate')?.error,
      ).toBeTruthy()
      expect(
        groupEditorIssues(result.errors, draft)[0]?.issues.join(' '),
      ).toContain('Annual percentage to move')
    },
  )
  it.each(['-1', '0.001', 'wrong'])(
    'rejects invalid prior year-end balance %j',
    (value) => {
      const draft = example()
      draft.accounts[1]!.priorYearEndBalance = value
      expect(evaluateProjection(draft)).toMatchObject({
        ok: false,
        errors: [
          expect.objectContaining({
            path: 'accounts.1.priorYearEndBalanceCents',
          }),
        ],
      })
    },
  )
  it('keeps old fixed-dollar entries and stored alternate drafts independent', () => {
    const draft = example()
    draft.finance!.transfers![0]!.amount = '25'
    const copy = copyPlan(draft, 'copy')
    const editor = () =>
      transferEditor(
        draft,
        (edit) => edit(draft),
        [],
        () => {},
      )
    expect(
      editor()[0]?.fields.some((field) => field.id === 'monthlyAmountCents'),
    ).toBe(false)
    editor()[0]!
      .fields.find((field) => field.id === 'amountKind')!
      .onChange('monthly-dollars')
    expect(
      editor()[0]?.fields.find((field) => field.id === 'monthlyAmountCents')
        ?.value,
    ).toBe('25')
    draft.finance!.transfers![0]!.annualPercentage =
      'inactive invalid percentage'
    delete draft.accounts[1]!.priorYearEndBalance
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.monthly[0]?.transfersOutCents).toBe(2500)
    expect(
      planReportView(result.projection, draft, options).percentageTransferRows,
    ).toEqual([])
    expect(copy.finance!.transfers![0]!.amountKind).toBe('annual-percentage')
    expect(copy.accounts[1]!.priorYearEndBalance).toBe('100000')
    editor()[0]!
      .fields.find((field) => field.id === 'amountKind')!
      .onChange('annual-percentage')
    editor()[0]!
      .fields.find((field) => field.id === 'annualRate')!
      .onChange('4')
    expect(draft.finance!.transfers![0]!.annualPercentage).toBe('4')
    expect(copy.finance!.transfers![0]!.annualPercentage).toBe('12')
  })
})
