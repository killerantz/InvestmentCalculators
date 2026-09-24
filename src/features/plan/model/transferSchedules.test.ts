import { describe, expect, it } from 'vitest'
import { createExamplePlan, removePhase, copyPlan } from './draft'
import { evaluatePlan } from './evaluate'
import { evaluateProjection } from './evaluateProjection'
import { groupEditorIssues } from './editorValidation'
import { transferEditor } from './transferEditor'
import {
  historicalBalanceContext,
  transferRangeLabel,
} from './transferPresentation'
import { planReportView, type ReportOptions } from './planReportView'
import { scheduleView } from './scheduleView'

function example() {
  const draft = createExamplePlan()
  draft.horizonMonths = '36'
  draft.phases[1]!.years = '41'
  draft.phases[1]!.changes = {}
  draft.phases[2]!.years = '42'
  for (const account of draft.accounts) {
    account.balance = account.id === 'workplace' ? '120000' : '0'
    account.annualRate = '0'
    account.contribution = '0'
  }
  draft.finance!.transfers = [
    {
      id: 'payout',
      label: 'Retirement payouts',
      phaseId: 'step-up',
      endPhaseId: null,
      kind: 'transfer',
      sourceAccountId: 'workplace',
      destinationAccountId: 'cash',
      amountKind: 'annual-percentage',
      annualPercentage: '4',
      amount: '250',
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

describe('named transfer schedules', () => {
  it('continues through plan end using calculated December balances and named calendar-year details', () => {
    const draft = example()
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.monthly[11]?.transfersOutCents).toBe(0)
    expect(result.projection.monthly[12]?.transfersOutCents).toBe(40000)
    expect(result.projection.monthly[24]?.transfersOutCents).toBe(38400)
    expect(result.projection.totals).toMatchObject({
      closingBalanceCents: 12000000,
      transfersOutCents: 940800,
    })
    const view = planReportView(result.projection, draft, options)
    expect(view.transferRows[0]?.cells.slice(0, 2)).toEqual([
      'Retirement payouts',
      'Savings step-up through end of plan',
    ])
    expect(
      view.percentageTransferRows.map((row) => row.cells.slice(0, 3)),
    ).toEqual([
      ['Retirement payouts', 'Savings step-up through end of plan', '2027'],
      ['Retirement payouts', 'Savings step-up through end of plan', '2028'],
    ])
    const schedule = scheduleView(result.projection.schedule, draft)
    expect(schedule.phases.map((phase) => phase.transfers.length)).toEqual([
      0, 1, 1,
    ])
    expect(schedule.phases[2]?.transfers[0]?.cells[0]).toBe(
      'Retirement payouts',
    )
  })
  it('uses inclusive explicit endings and preserves legacy single-phase defaults', () => {
    const draft = example()
    const transfer = draft.finance!.transfers![0]!
    transfer.amountKind = 'monthly-dollars'
    transfer.phaseId = 'start'
    transfer.endPhaseId = 'step-up'
    let result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.totals.transfersOutCents).toBe(600000)
    expect(result.projection.monthly[23]?.transfersOutCents).toBe(25000)
    expect(result.projection.monthly[24]?.transfersOutCents).toBe(0)
    expect(transferRangeLabel(transfer, draft.phases)).toBe(
      'Accumulation through Savings step-up (inclusive)',
    )
    delete transfer.endPhaseId
    result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.totals.transfersOutCents).toBe(300000)
    expect(transferRangeLabel(transfer, draft.phases)).toBe('Accumulation only')
  })
  it('preserves names and endpoints in copies and supports last-phase disabled ending', () => {
    const draft = example()
    const copy = copyPlan(draft, 'copy')
    const editor = () =>
      transferEditor(
        draft,
        (edit) => edit(draft),
        [],
        () => {},
      )
    editor()[0]!
      .fields.find((field) => field.id === 'label')!
      .onChange('Bridge conversions')
    expect(editor()[0]!.label).toBe('Bridge conversions')
    editor()[0]!
      .fields.find((field) => field.id === 'endPhaseId')!
      .onChange('step-up')
    expect(draft.finance!.transfers![0]!.endPhaseId).toBe('step-up')
    editor()[0]!
      .fields.find((field) => field.id === 'phaseId')!
      .onChange('bridge')
    expect(draft.finance!.transfers![0]!.endPhaseId).toBeNull()
    expect(
      editor()[0]!.fields.find((field) => field.id === 'endPhaseId'),
    ).toMatchObject({
      disabled: true,
      value: '',
    })
    editor()[0]!
      .fields.find((field) => field.id === 'phaseId')!
      .onChange('start')
    expect(
      editor()[0]!.fields.find((field) => field.id === 'endPhaseId')?.disabled,
    ).toBe(false)
    expect(copy.finance!.transfers![0]!.label).toBe('Retirement payouts')
    expect(copy.finance!.transfers![0]!.phaseId).toBe('step-up')
  })
  it('routes blank names and invalid endings to named transfer fields', () => {
    const draft = example()
    draft.finance!.transfers![0]!.endPhaseId = 'start'
    let result = evaluateProjection(draft)
    if (result.ok) throw new Error('Reversed ranges must fail.')
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'transfers.0.endPhaseId' }),
    )
    expect(
      groupEditorIssues(result.errors, draft)[0]?.issues.join(' '),
    ).toContain('Retirement payouts')
    draft.finance!.transfers![0]!.label = ''
    result = evaluateProjection(draft)
    if (result.ok) throw new Error('An explicitly empty name must fail.')
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: 'transfers.0.label' }),
    )
    const editor = transferEditor(
      draft,
      () => {},
      result.errors,
      () => {},
    )
    expect(
      editor[0]?.fields.find((field) => field.id === 'label'),
    ).toMatchObject({ value: '', error: 'Enter a transfer name.' })
  })
  it('removes endpoint-dependent transfers but preserves ones spanning a deleted intermediate phase', () => {
    const draft = example()
    draft.finance!.transfers![0]!.phaseId = 'start'
    draft.finance!.transfers![0]!.endPhaseId = 'bridge'
    draft.finance!.transfers!.push({
      ...draft.finance!.transfers![0]!,
      id: 'ending',
      endPhaseId: 'step-up',
    })
    removePhase(draft, 'step-up')
    expect(draft.finance!.transfers!.map((entry) => entry.id)).toEqual([
      'payout',
    ])
    expect(draft.finance!.transfers![0]!.endPhaseId).toBe('bridge')
  })
})

describe('historical balance field relevance', () => {
  it('hides unnecessary fields for a plan starting before distributions, while showing first-year source fields only', () => {
    const draft = example()
    const result = evaluatePlan(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(
      historicalBalanceContext('workplace', draft, result.plan).visible,
    ).toBe(false)
    expect(historicalBalanceContext('cash', draft, result.plan).visible).toBe(
      false,
    )
    draft.finance!.transfers![0]!.phaseId = 'start'
    const context = historicalBalanceContext('workplace', draft, result.plan)
    expect(context).toMatchObject({
      visible: true,
      label: 'December 31, 2025 balance ($)',
    })
    expect(context.hint).toContain('first calendar year')
    expect(historicalBalanceContext('cash', draft, result.plan).visible).toBe(
      false,
    )
  })
  it('keeps entered values accessible rather than silently hiding or discarding them', () => {
    const draft = example()
    draft.accounts[1]!.priorYearEndBalance = '0'
    const result = evaluatePlan(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(
      historicalBalanceContext('workplace', draft, result.plan),
    ).toMatchObject({ visible: true })
    expect(
      historicalBalanceContext('workplace', draft, result.plan).hint,
    ).toContain('not needed by the current')
    expect(historicalBalanceContext('workplace', draft, null).hint).toContain(
      'Validate',
    )
    expect(draft.accounts[1]!.priorYearEndBalance).toBe('0')
  })
})
