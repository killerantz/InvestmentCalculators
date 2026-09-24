import { describe, expect, it } from 'vitest'
import {
  copyPlan,
  createExamplePlan,
  emptyChange,
  newAccount,
  removeAccount,
} from './draft'
import { financeDraft, inheritedCashFlow, moveWithdrawal } from './financeDraft'
import { financeEditor } from './financeEditor'
import { evaluateProjection } from './evaluateProjection'
import { groupEditorIssues } from './editorValidation'
import { planReportView, type ReportOptions } from './planReportView'

function example() {
  const draft = createExamplePlan()
  draft.horizonMonths = '13'
  draft.phases = draft.phases.slice(0, 1)
  draft.partnerEnabled = true
  for (const account of draft.accounts) {
    account.balance = '100'
    account.contribution = '0'
    account.annualRate = '0'
  }
  draft.finance = {
    ...financeDraft(draft),
    spending: '40',
    withdrawalOrder: ['cash', 'workplace'],
    incomes: [
      {
        id: 'primary-ss',
        label: 'Primary Social Security',
        person: 'primary',
        kind: 'social-security',
        years: '40',
        months: '0',
        amount: '25',
        increase: '12',
      },
      {
        id: 'partner-pension',
        label: 'Partner pension',
        person: 'partner',
        kind: 'pension',
        years: '38',
        months: '6',
        amount: '10',
        increase: '0',
      },
    ],
  }
  return draft
}

describe('income and phased cash-flow editor', () => {
  it('parses each recipient, start age, nominal first payment and anniversary assumption', () => {
    const result = evaluateProjection(example())
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.monthly[0]?.incomeCents).toBe(2500)
    expect(result.projection.monthly[5]?.incomeCents).toBe(2500)
    expect(result.projection.monthly[6]?.incomeCents).toBe(3500)
    expect(result.projection.monthly[12]?.incomeCents).toBe(3800)
  })
  it.each(['', '-1', '1,000', '1.001'])(
    'rejects invalid monthly payment %j',
    (amount) => {
      const draft = example()
      draft.finance!.incomes[0]!.amount = amount
      expect(evaluateProjection(draft)).toMatchObject({
        ok: false,
        errors: [{ path: 'incomes.0.monthlyAmountCents' }],
      })
    },
  )
  it.each(['', '12', '1.5', '-1'])(
    'rejects invalid additional payment age months %j',
    (months) => {
      const draft = example()
      draft.finance!.incomes[0]!.months = months
      expect(evaluateProjection(draft)).toMatchObject({
        ok: false,
        errors: [{ path: 'incomes.0.startAgeMonths' }],
      })
    },
  )
  it('routes missing partner and payment validation to Income & spending', () => {
    const draft = example()
    draft.partnerEnabled = false
    const result = evaluateProjection(draft)
    if (result.ok)
      throw new Error('Partner income without a partner must fail.')
    const groups = groupEditorIssues(result.errors, draft)
    expect(groups.map((group) => group.value)).toContain('income')
    expect(groups.flatMap((group) => group.issues).join(' ')).toContain(
      'Partner pension',
    )
  })
  it('keeps new fields optional for existing drafts, requiring a deliberate cash destination', () => {
    const draft = example()
    delete draft.finance
    const before = structuredClone(draft)
    expect(financeDraft(draft).withdrawalOrder).toEqual([])
    expect(evaluateProjection(draft).ok).toBe(false)
    expect(draft).toEqual(before)
  })
  it('keeps financial draft copies independent and removes account references everywhere', () => {
    const draft = example()
    draft.phases[0]!.cashFlow = {
      spending: '10',
      withdrawalOrder: ['cash', 'workplace'],
    }
    const copy = copyPlan(draft, 'copy')
    copy.finance!.incomes[0]!.amount = '50'
    removeAccount(copy, 'cash')
    expect(copy.finance!.cashAccountId).toBe('')
    expect(copy.finance!.withdrawalOrder).toEqual(['workplace'])
    expect(copy.phases[0]!.cashFlow!.withdrawalOrder).toEqual(['workplace'])
    expect(draft.finance!.incomes[0]!.amount).toBe('25')
    expect(draft.finance!.cashAccountId).toBe('cash')
  })
  it('inherits spending and withdrawal order, including explicit zero and empty overrides', () => {
    const draft = createExamplePlan()
    draft.finance!.spending = '100'
    draft.phases[0]!.cashFlow = { spending: '0', withdrawalOrder: [] }
    expect(inheritedCashFlow(draft, 2)).toEqual({
      spending: '0',
      withdrawalOrder: [],
    })
    draft.phases[1]!.cashFlow = {
      spending: '50',
      withdrawalOrder: ['workplace'],
    }
    expect(inheritedCashFlow(draft, 2)).toEqual({
      spending: '50',
      withdrawalOrder: ['workplace'],
    })
    expect(inheritedCashFlow(draft, 1)).toEqual({
      spending: '0',
      withdrawalOrder: [],
    })
  })
  it('reorders only included accounts without mutating the original', () => {
    const order = ['cash', 'workplace']
    expect(moveWithdrawal(order, 'workplace', -1)).toEqual([
      'workplace',
      'cash',
    ])
    expect(moveWithdrawal(order, 'cash', 1)).toEqual(['workplace', 'cash'])
    expect(order).toEqual(['cash', 'workplace'])
    expect(() => moveWithdrawal(order, 'cash', -1)).toThrow()
    expect(() => moveWithdrawal(order, 'missing', 1)).toThrow()
  })
  it('prepares inline financial errors and independent form callbacks', () => {
    const draft = example()
    const model = financeEditor(
      draft,
      (edit) => edit(draft),
      [
        { path: 'incomes.0.startAgeMonths', message: 'Invalid age.' },
        { path: 'cashAccountId', message: 'Choose an account.' },
      ],
      () => {},
    )
    expect(model.fields[0]?.error).toBe('Choose an account.')
    expect(model.incomes[0]?.fields.filter((field) => field.error).length).toBe(
      2,
    )
    expect(
      new Set(model.incomes[0]?.fields.map((field) => field.id)).size,
    ).toBe(model.incomes[0]?.fields.length)
    model.phases[0]!.spendingToggle(true)
    model.phases[0]!.fields[0]!.onChange('0')
    expect(draft.phases[0]!.cashFlow?.spending).toBe('0')
  })
  it('applies a phase spending override at the exact month and reports invalid phase money in Phases', () => {
    const draft = example()
    draft.phases.push({
      id: 'next',
      label: 'Next',
      person: 'primary',
      years: '40',
      months: '6',
      changes: {},
      cashFlow: { spending: '0', withdrawalOrder: [] },
    })
    const result = evaluateProjection(draft)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.monthly[5]?.requestedSpendingCents).toBe(4000)
    expect(result.projection.monthly[6]?.requestedSpendingCents).toBe(0)
    draft.phases[1]!.cashFlow!.spending = ''
    const invalid = evaluateProjection(draft)
    if (invalid.ok) throw new Error('Blank spending should fail.')
    expect(groupEditorIssues(invalid.errors, draft)[0]?.value).toBe('phases')
  })
})

describe('projection presentation', () => {
  const options: ReportOptions = {
    interval: 'annual',
    year: 1,
    hiddenSeries: [],
    timeUnit: 'years',
    metric: 'closing',
    basis: 'nominal',
    realColumns: false,
  }
  it('marks phase starts at their exact boundaries, not the first month-end', () => {
    const draft = example()
    draft.phases.push(
      {
        id: 'next',
        label: 'Next phase',
        person: 'primary',
        years: '40',
        months: '6',
        changes: {},
      },
      {
        id: 'last',
        label: 'Final phase',
        person: 'primary',
        years: '41',
        months: '0',
        changes: {},
      },
    )
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const years = planReportView(outcome.projection, draft, options)
    expect(years.phaseMarkers.map((marker) => marker.x)).toEqual([0, 0.5, 1])
    expect(years.phaseMarkers[1]).toEqual({
      id: 'next',
      x: 0.5,
      label: 'Phase 2: Next phase',
      detail:
        'Starts 2026-07; 0y 6m from plan start; primary age 40y 6m; partner age 38y 6m. Applies to the following monthly period.',
    })
    const months = planReportView(outcome.projection, draft, {
      ...options,
      timeUnit: 'months',
      metric: 'growth',
      basis: 'today',
      hiddenSeries: ['household', 'account:cash'],
    })
    expect(months.phaseMarkers.map((marker) => marker.x)).toEqual([0, 6, 12])
    expect(months.phaseMarkers[2]?.detail).toContain(
      'Starts 2027-01; 12 months',
    )
    expect(months.totals).toEqual(years.totals)
    expect(months.phaseRows).toEqual(years.phaseRows)
  })
  it('retains the plan-start marker for a single-month, single-phase projection', () => {
    const draft = example()
    draft.horizonMonths = '1'
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const view = planReportView(outcome.projection, draft, options)
    expect(view.phaseMarkers).toHaveLength(1)
    expect(view.phaseMarkers[0]?.x).toBe(0)
    expect(view.flowSeries[0]?.points).toHaveLength(1)
  })
  it.each([false, true])(
    'keeps yearly, monthly and account table shapes aligned (real columns %s)',
    (realColumns) => {
      const draft = example()
      const outcome = evaluateProjection(draft)
      if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
      for (const interval of ['annual', 'monthly'] as const) {
        const view = planReportView(outcome.projection, draft, {
          ...options,
          interval,
          realColumns,
        })
        expect(view.ledger.length).toBe(interval === 'annual' ? 2 : 12)
        for (const row of view.ledger)
          expect(row.cells.length).toBe(view.columns.length)
        for (const account of view.accountLedgers)
          for (const row of account.rows)
            expect(row.cells.length).toBe(view.accountColumns.length)
        for (const row of view.incomeRows)
          expect(row.cells.length).toBe(view.incomeColumns.length)
        expect(view.series[0]?.points).toHaveLength(14)
      }
    },
  )
  it('preserves exact ledger money, partial year navigation and account-specific charts', () => {
    const draft = example()
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const view = planReportView(outcome.projection, draft, {
      ...options,
      interval: 'monthly',
      year: 2,
      hiddenSeries: ['household', 'account:cash'],
    })
    expect(view.ledger).toHaveLength(1)
    expect(view.incomeRows[0]?.cells).toEqual(['2027-01', '$28.00', '$10.00'])
    expect(view.series[0]?.label).toContain('Workplace savings')
    expect(view.series[0]?.points.at(-1)?.y).toBe(
      outcome.projection.accounts[1]!.closingBalanceCents / 100,
    )
  })
  it('uses engine real monthly growth rather than discounting cumulative nominal growth', () => {
    const draft = example()
    draft.finance!.inflation = '10'
    draft.accounts[0]!.annualRate = '12'
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const view = planReportView(outcome.projection, draft, {
      ...options,
      metric: 'growth',
      basis: 'today',
    })
    expect(view.series[0]?.points.at(-1)?.y).toBe(
      outcome.projection.totals.realGrowthCents / 100,
    )
  })
  it('shows starting household and account balances, not zero, in either dollar basis', () => {
    const draft = example()
    draft.finance!.inflation = '10'
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    for (const basis of ['nominal', 'today'] as const) {
      const view = planReportView(outcome.projection, draft, {
        ...options,
        basis,
      })
      expect(view.startingBalance).toBe('$200.00')
      expect(view.totals[0]?.cells).toEqual([
        'Starting balance (all accounts)',
        '$200.00',
      ])
      expect(view.series.map((line) => line.points[0])).toEqual([
        { x: 0, y: 200 },
        { x: 0, y: 100 },
        { x: 0, y: 100 },
      ])
      expect(view.series.map((line) => line.id)).toEqual([
        'household',
        'account:cash',
        'account:workplace',
      ])
      expect(view.seriesOptions.every((item) => item.checked)).toBe(true)
    }
  })
  it.each(['closing', 'growth'] as const)(
    'compares all accounts and keeps the household %s equal to their sum',
    (metric) => {
      const draft = example()
      draft.accounts[0]!.annualRate = '12'
      draft.accounts[1]!.annualRate = '-5'
      draft.finance!.inflation = '10'
      const outcome = evaluateProjection(draft)
      if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
      for (const basis of ['nominal', 'today'] as const) {
        const view = planReportView(outcome.projection, draft, {
          ...options,
          metric,
          basis,
        })
        const [household, ...accounts] = view.series
        expect(household).toBeDefined()
        for (const [index, point] of household!.points.entries()) {
          expect(point.y).toBeCloseTo(
            accounts.reduce((sum, line) => sum + line.points[index]!.y, 0),
            8,
          )
        }
        if (metric === 'growth') {
          expect(view.series.every((line) => line.points[0]?.y === 0)).toBe(
            true,
          )
          expect(view.metricDescription).toContain('excludes starting funds')
          for (const [
            index,
            account,
          ] of outcome.projection.accounts.entries()) {
            expect(view.series[index + 1]?.points.at(-1)?.y).toBe(
              (basis === 'today'
                ? account.realGrowthCents
                : account.growthCents) / 100,
            )
          }
        }
      }
    },
  )
  it.each([1, 13, 480, 1200])(
    'keeps all monthly values when displaying a %i-month horizon in years',
    (horizon) => {
      const draft = example()
      draft.horizonMonths = String(horizon)
      const outcome = evaluateProjection(draft)
      if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
      const years = planReportView(outcome.projection, draft, options)
      const months = planReportView(outcome.projection, draft, {
        ...options,
        timeUnit: 'months',
      })
      expect(years.xLabel).toBe('Years since plan start')
      expect(months.xLabel).toBe('Months since plan start')
      for (const [index, line] of years.series.entries()) {
        expect(line.points).toHaveLength(horizon + 1)
        expect(line.points.at(-1)?.x).toBe(horizon / 12)
        expect(months.series[index]?.points).toEqual(
          line.points.map((point, month) => ({ x: month, y: point.y })),
        )
      }
      expect(years.flowSeries[0]?.points.at(-1)?.x).toBe(horizon / 12)
      expect(months.flowSeries[0]?.points.at(-1)?.x).toBe(horizon)
      expect(years.formatChartTime(13 / 12)).toBe(
        '1y 1m; primary age 41y 1m; partner age 39y 1m',
      )
      expect(months.formatChartTime(13)).toBe(
        '13; primary age 41y 1m; partner age 39y 1m',
      )
      expect(years.totals).toEqual(months.totals)
      expect(years.ledger).toEqual(months.ledger)
    },
  )
  it('hides any combination, including all lines, without changing totals or line styles', () => {
    const draft = example()
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const all = planReportView(outcome.projection, draft, options)
    const hidden = planReportView(outcome.projection, draft, {
      ...options,
      hiddenSeries: ['household', 'account:cash'],
    })
    expect(hidden.series).toEqual([all.series[2]])
    expect(hidden.seriesOptions.map((item) => item.checked)).toEqual([
      false,
      false,
      true,
    ])
    expect(hidden.totals).toEqual(all.totals)
    const none = planReportView(outcome.projection, draft, {
      ...options,
      hiddenSeries: all.seriesOptions.map((item) => item.id),
    })
    expect(none.series).toEqual([])
    expect(none.totals).toEqual(all.totals)
  })
  it('keeps account lines distinguishable even when account names repeat or match the total', () => {
    const draft = example()
    for (const account of draft.accounts)
      account.label = 'Household total (all accounts)'
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const view = planReportView(outcome.projection, draft, options)
    expect(new Set(view.series.map((item) => item.label)).size).toBe(3)
  })
  it.each([true, false])(
    'shows one starting-age column in every ledger (partner %s)',
    (partnerEnabled) => {
      const draft = example()
      draft.finance!.incomes = []
      draft.primaryMonths = '8'
      draft.partnerMonths = '11'
      draft.partnerEnabled = partnerEnabled
      const outcome = evaluateProjection(draft)
      if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
      const annual = planReportView(outcome.projection, draft, options)
      const expected = ['Year 1', partnerEnabled ? '40y 8m, 38y 11m' : '40y 8m']
      expect(annual.ledger[0]?.cells.slice(0, expected.length)).toEqual(
        expected,
      )
      expect(
        annual.accountLedgers[0]?.rows[0]?.cells.slice(0, expected.length),
      ).toEqual(expected)
      expect(annual.ledger[1]?.cells.slice(0, expected.length)).toEqual([
        'Year 2 (partial)',
        partnerEnabled ? '41y 8m, 39y 11m' : '41y 8m',
      ])
      expect(annual.planEndSummary).toContain('primary age 41y 9m')
      const monthly = planReportView(outcome.projection, draft, {
        ...options,
        interval: 'monthly',
        year: 2,
      })
      expect(monthly.ledger[0]?.cells.slice(0, expected.length)).toEqual([
        '2027-01',
        partnerEnabled ? '41y 8m, 39y 11m' : '41y 8m',
      ])
      expect(
        monthly.accountLedgers[0]?.rows[0]?.cells.slice(0, expected.length),
      ).toEqual(monthly.ledger[0]?.cells.slice(0, expected.length))
      expect(annual.planEndSummary).toContain(
        partnerEnabled ? 'partner age 40y 0m' : 'primary age 41y 9m',
      )
      if (!partnerEnabled)
        expect(annual.planEndSummary).not.toContain('partner')
      for (const view of [annual, monthly]) {
        const ageLabel = partnerEnabled
          ? 'Age (primary, partner)'
          : 'Age (primary)'
        expect(
          view.columns.filter((column) => column.startsWith('Age')),
        ).toEqual([ageLabel])
        expect(
          view.accountColumns.filter((column) => column.startsWith('Age')),
        ).toEqual([ageLabel])
        for (const row of view.ledger)
          expect(row.cells.length).toBe(view.columns.length)
        for (const account of view.accountLedgers)
          for (const row of account.rows)
            expect(row.cells.length).toBe(view.accountColumns.length)
      }
    },
  )
  it('traces new external savings by account and phase, and respects explicit zero overrides', () => {
    const draft = example()
    draft.horizonMonths = '36'
    draft.finance!.incomes = []
    draft.finance!.spending = '0'
    draft.accounts.push({
      ...newAccount('roth'),
      label: 'Example Roth',
      kind: 'roth-ira',
      contribution: '0',
      annualRate: '0',
    })
    draft.phases.push(
      {
        id: 'bridge',
        label: 'Bridge',
        person: 'primary',
        years: '41',
        months: '0',
        changes: {
          cash: { ...emptyChange(), contribution: '0' },
          workplace: { ...emptyChange(), contribution: '0' },
          roth: { ...emptyChange(), contribution: '250' },
        },
      },
      {
        id: 'later',
        label: 'Later',
        person: 'primary',
        years: '42',
        months: '6',
        changes: {
          roth: { ...emptyChange(), contribution: '0' },
        },
      },
    )
    const outcome = evaluateProjection(draft)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    const view = planReportView(outcome.projection, draft, options)
    expect(
      view.contributionRows.find((row) => row.id === 'bridge:roth')?.cells,
    ).toEqual(['Bridge', 'Example Roth', '$250.00', 'Bridge', '$4,500.00'])
    expect(outcome.projection.annual[1]?.externalContributionsCents).toBe(
      300000,
    )
    expect(outcome.projection.annual[2]?.externalContributionsCents).toBe(
      150000,
    )
    expect(
      view.contributionRows.find((row) => row.id === 'later:cash')?.cells,
    ).toEqual(['Later', 'Cash reserve', '$0.00', 'Bridge', '$0.00'])
    draft.phases[1]!.changes.roth!.contribution = '0'
    const zero = evaluateProjection(draft)
    if (!zero.ok) throw new Error(JSON.stringify(zero.errors))
    expect(
      zero.projection.monthly
        .slice(12)
        .every((row) => row.externalContributionsCents === 0),
    ).toBe(true)
    const zeroView = planReportView(zero.projection, draft, options)
    expect(
      zeroView.contributionRows
        .filter((row) => row.cells[0] === 'Bridge')
        .every((row) => row.cells[2] === '$0.00' && row.cells[4] === '$0.00'),
    ).toBe(true)
  })
})
