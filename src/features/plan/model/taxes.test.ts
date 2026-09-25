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
import {
  accountTaxDraft,
  inheritedTaxRates,
  inheritedTaxPaymentOrder,
  newTaxDraft,
  parseTaxDraft,
} from './taxDraft'
import { taxEditor } from './taxEditor'

const reportOptions: ReportOptions = {
  interval: 'annual',
  year: 1,
  hiddenSeries: [],
  timeUnit: 'years',
  metric: 'closing',
  basis: 'nominal',
  realColumns: false,
}

function example() {
  const plan = createExamplePlan()
  plan.horizonMonths = '1'
  plan.phases = plan.phases.slice(0, 1)
  for (const account of plan.accounts) {
    account.balance = account.kind === 'savings' ? '0' : '2000'
    account.contribution = '0'
    account.annualRate = '0'
  }
  plan.finance!.spending = '1000'
  plan.finance!.withdrawalOrder = ['workplace']
  plan.taxes = {
    ...newTaxDraft(),
    enabled: true,
    ordinaryRate: '20',
    capitalGainsRate: '15',
    qualifiedDividendRate: '10',
  }
  return plan
}

describe('optional life-phase tax worksheet', () => {
  it('edits the preferred tax order independently using the existing reorder controls', () => {
    const plan = example()
    const model = () => taxEditor(plan, (edit) => edit(plan), [])
    expect(model().separateOrder).toBe(false)
    model().toggleSeparateOrder(true)
    expect(plan.taxes!.paymentOrder).toEqual(['workplace'])
    model()
      .order.accounts.find((account) => account.id === 'cash')!
      .toggle(true)
    model()
      .order.accounts.find((account) => account.id === 'cash')!
      .earlier()
    expect(plan.taxes!.paymentOrder).toEqual(['cash', 'workplace'])
    expect(plan.finance!.withdrawalOrder).toEqual(['workplace'])
    model().phases[0]!.orderFields[0]!.onChange('custom')
    model()
      .phases[0]!.order!.accounts.find((account) => account.id === 'workplace')!
      .toggle(false)
    expect(inheritedTaxPaymentOrder(plan, 1)).toEqual(['cash'])
    expect(plan.taxes!.paymentOrder).toEqual(['cash', 'workplace'])
    expect(inheritedTaxRates(plan, 1)).toEqual({
      ordinaryRate: '20',
      capitalGainsRate: '15',
      qualifiedDividendRate: '10',
    })
    model().phases[0]!.orderFields[0]!.onChange('follow')
    expect(parseTaxDraft(plan, [])!.phaseRates[0]).toEqual({
      phaseId: 'start',
      paymentOrder: null,
    })
    expect(inheritedTaxPaymentOrder(plan, 1)).toBeNull()
    model().phases[0]!.orderFields[0]!.onChange('inherit')
    expect(inheritedTaxPaymentOrder(plan, 1)).toEqual(['cash', 'workplace'])
    model().toggleSeparateOrder(false)
    expect(parseTaxDraft(plan, [])).not.toHaveProperty('paymentOrder')
  })

  it('keeps copied funding orders independent and cleans deleted account references', () => {
    const plan = example()
    plan.taxes!.paymentOrder = ['cash', 'workplace']
    plan.taxes!.phaseRates.start = { paymentOrder: ['workplace', 'cash'] }
    const copy = copyPlan(plan, 'copy')
    removeAccount(copy, 'workplace')
    expect(copy.taxes!.paymentOrder).toEqual(['cash'])
    expect(copy.taxes!.phaseRates.start!.paymentOrder).toEqual(['cash'])
    expect(plan.taxes!.paymentOrder).toEqual(['cash', 'workplace'])
    expect(plan.taxes!.phaseRates.start!.paymentOrder).toEqual([
      'workplace',
      'cash',
    ])
    copy.taxes!.enabled = false
    expect(parseTaxDraft(copy, [])).toBeUndefined()
    expect(copy.taxes!.paymentOrder).toEqual(['cash'])
  })

  it('reports custom funding and fallback orders alongside accurate tax results', () => {
    const plan = example()
    plan.accounts[0]!.balance = '1000'
    plan.taxes!.paymentOrder = ['cash']
    const result = evaluateProjection(plan)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.projection.taxes!.totals.taxPaidCents).toBe(20_000)
    expect(
      result.projection.monthly[0]!.accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([20_000, 100_000])
    const report = planReportView(result.projection, plan, reportOptions)
    expect(report.taxReport!.funding.rows[0]!.cells).toEqual([
      'Accumulation',
      'Cash reserve',
      'Workplace savings',
    ])
    plan.taxes!.phaseRates.start = { paymentOrder: null }
    const follow = evaluateProjection(plan)
    if (!follow.ok) throw new Error(JSON.stringify(follow.errors))
    expect(follow.projection.taxes!.totals.taxPaidCents).toBe(25_000)
    expect(
      planReportView(follow.projection, plan, reportOptions).taxReport!.funding
        .rows[0]!.cells[1],
    ).toBe('Follow spending withdrawal order')
  })

  it('routes invalid tax order references to the tax section and inline controls', () => {
    const plan = example()
    plan.taxes!.paymentOrder = ['missing']
    plan.taxes!.phaseRates.start = { paymentOrder: ['cash', 'cash'] }
    const result = evaluateProjection(plan)
    if (result.ok) throw new Error('Invalid funding references must fail.')
    const groups = groupEditorIssues(result.errors, plan)
    expect(groups.map((group) => group.value)).toEqual(['taxes'])
    expect(
      groups[0]!.issues.every((issue) => issue.includes('Tax payment order')),
    ).toBe(true)
    const model = taxEditor(plan, (edit) => edit(plan), result.errors)
    expect(model.order.error).toContain('does not exist')
    expect(model.phases[0]!.order!.error).toContain('must not repeat')
  })

  it('reports tax percentage bounds in the same units as the fields', () => {
    const plan = example()
    plan.taxes!.ordinaryRate = '101'
    plan.finance!.incomes.push({
      id: 'ss',
      label: 'Social Security',
      kind: 'social-security',
      person: 'primary',
      years: '40',
      months: '0',
      amount: '100',
      increase: '0',
    })
    plan.taxes!.incomeShares.ss = '86'
    const errors: Parameters<typeof parseTaxDraft>[1] = []
    parseTaxDraft(plan, errors)
    expect(errors).toEqual([
      {
        path: 'taxes.ordinaryRate',
        message: 'Enter a percentage from 0 to 100.',
      },
      {
        path: 'taxes.incomes.0.taxableShare',
        message: 'Enter a percentage from 0 to 85.',
      },
    ])
    plan.taxes!.ordinaryRate = '100'
    plan.taxes!.incomeShares.ss = '85'
    const validErrors: Parameters<typeof parseTaxDraft>[1] = []
    parseTaxDraft(plan, validErrors)
    expect(validErrors).toEqual([])
  })

  it('parses only active brokerage accounts and applies pension defaults without guessing Social Security', () => {
    const plan = example()
    plan.accounts.push({
      ...newAccount('brokerage'),
      kind: 'taxable',
      balance: '100',
    })
    plan.taxes!.accounts.brokerage = {
      costBasis: '150',
      dividendYield: '4',
      qualifiedShare: '60',
    }
    plan.taxes!.accounts.workplace = {
      costBasis: 'invalid',
      dividendYield: 'invalid',
      qualifiedShare: 'invalid',
    }
    plan.finance!.incomes.push({
      id: 'pension',
      label: 'Pension',
      kind: 'pension',
      person: 'primary',
      years: '40',
      months: '0',
      amount: '100',
      increase: '0',
    })
    const errors: Parameters<typeof parseTaxDraft>[1] = []
    expect(parseTaxDraft(plan, errors)).toMatchObject({
      accounts: [
        {
          accountId: 'brokerage',
          costBasisCents: 15_000,
          annualDividendYield: 0.04,
          qualifiedDividendShare: 0.6,
        },
      ],
      incomes: [{ incomeId: 'pension', taxableShare: 1 }],
    })
    expect(errors).toEqual([])
    plan.finance!.incomes[0]!.kind = 'social-security'
    parseTaxDraft(plan, errors)
    expect(errors[0]!.path).toBe('taxes.incomes.0.taxableShare')
  })

  it('uses filtered phase indices consistently for parsing, inline errors, and issue context', () => {
    const plan = example()
    plan.phases.push({
      id: 'next',
      label: 'Next phase',
      person: 'primary',
      years: '40',
      months: '1',
      changes: {},
    })
    plan.taxes!.phaseRates.start = {}
    plan.taxes!.phaseRates.next = { capitalGainsRate: '' }
    const errors: Parameters<typeof parseTaxDraft>[1] = []
    parseTaxDraft(plan, errors)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.path).toBe('taxes.phaseRates.0.capitalGainsRate')
    const model = taxEditor(plan, (edit) => edit(plan), errors)
    expect(model.phases[1]!.rates[1]!.fields[0]!.error).toBe(errors[0]!.message)
    expect(groupEditorIssues(errors, plan)[0]!.issues[0]).toContain(
      'Next phase - Realized-gain tax rate',
    )
  })

  it('leaves taxes disabled for old drafts and ignores incomplete disabled tax drafts', () => {
    const plan = example()
    delete plan.taxes
    const original = evaluateProjection(plan)
    plan.taxes = newTaxDraft()
    plan.taxes.accounts.workplace = {
      costBasis: 'invalid',
      dividendYield: '-',
      qualifiedShare: '',
    }
    expect(evaluateProjection(plan)).toEqual(original)
    if (!original.ok) throw new Error(JSON.stringify(original.errors))
    expect(original.projection.taxes).toBeUndefined()
    expect(original.projection.totals.automaticWithdrawalsCents).toBe(100_000)
    expect(
      planReportView(original.projection, plan, reportOptions).taxReport,
    ).toBeUndefined()
  })

  it('parses rates and funds estimated taxes as well as spending', () => {
    const plan = example()
    const outcome = evaluateProjection(plan)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    expect(outcome.projection.totals).toMatchObject({
      automaticWithdrawalsCents: 125_000,
      spendingCents: 100_000,
      shortfallCents: 0,
    })
    expect(outcome.projection.taxes?.totals).toMatchObject({
      taxPaidCents: 25_000,
      unpaidTaxCents: 0,
    })
    const report = planReportView(outcome.projection, plan, reportOptions)
    expect(report.flowSeries.map((series) => series.id)).toContain('taxes')
    expect(
      report.taxReport?.summary.rows.find((row) => row.id === 'taxPaidCents')
        ?.cells,
    ).toEqual(['Tax paid from household funds', '$250.00'])
    expect(report.ledger[0]!.cells).toHaveLength(report.columns.length)
    expect(report.ledger[0]!.cells.slice(-2)).toEqual(['$250.00', '$0.00'])
    for (const table of [
      report.taxReport!.summary,
      report.taxReport!.accounts,
      report.taxReport!.ledger,
    ])
      for (const row of table.rows)
        expect(row.cells).toHaveLength(table.columns.length)
    const monthly = planReportView(outcome.projection, plan, {
      ...reportOptions,
      interval: 'monthly',
    })
    expect(monthly.taxReport!.ledger.rows[0]!.cells[0]).toBe('2026-01')
    expect(monthly.ledger[0]!.cells).toHaveLength(monthly.columns.length)
  })

  it('requires explicit baseline rates, brokerage basis, and Social Security taxable share', () => {
    const plan = example()
    plan.accounts.push({
      ...newAccount('brokerage'),
      kind: 'taxable',
      label: 'Brokerage',
    })
    plan.taxes = { ...newTaxDraft(), enabled: true }
    plan.finance!.incomes.push({
      id: 'ss',
      label: 'Social Security',
      kind: 'social-security',
      person: 'primary',
      years: '40',
      months: '0',
      amount: '100',
      increase: '0',
    })
    const outcome = evaluateProjection(plan)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        'taxes.ordinaryRate',
        'taxes.capitalGainsRate',
        'taxes.qualifiedDividendRate',
        'taxes.accounts.0.costBasisCents',
        'taxes.incomes.0.taxableShare',
      ]),
    )
    const groups = groupEditorIssues(outcome.errors, plan)
    expect(groups.map((group) => group.value)).toEqual(['taxes'])
    expect(groups[0]!.issues.join(' ')).toContain(
      'Brokerage - Starting pooled cost basis',
    )
    expect(groups[0]!.issues.join(' ')).toContain(
      'Social Security - Taxable share of payment',
    )
  })

  it('keeps estimated dividends within total return and exposes brokerage tax details', () => {
    const plan = example()
    plan.finance!.spending = '0'
    plan.finance!.withdrawalOrder = ['cash', 'workplace']
    plan.accounts[0]!.balance = '100'
    plan.accounts.push({
      ...newAccount('brokerage'),
      kind: 'taxable',
      label: 'Brokerage',
      balance: '1000',
      annualRate: '0',
    })
    plan.taxes!.accounts.brokerage = {
      costBasis: '800',
      dividendYield: '12',
      qualifiedShare: '50',
    }
    const outcome = evaluateProjection(plan)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    expect(
      outcome.projection.monthly[0]!.accounts.find(
        (account) => account.accountId === 'brokerage',
      )!.closingBalanceCents,
    ).toBe(100_000)
    expect(outcome.projection.taxes!.totals).toMatchObject({
      ordinaryDividendsCents: 500,
      qualifiedDividendsCents: 500,
      taxPaidCents: 150,
    })
    const report = planReportView(outcome.projection, plan, reportOptions)
    expect(
      report
        .taxReport!.accounts.rows.find((row) => row.id === 'brokerage')!
        .cells.slice(1, 3),
    ).toEqual(['$800.00', '$810.00'])
  })

  it('carries phase rates forward and respects an explicit zero override', () => {
    const plan = example()
    plan.horizonMonths = '3'
    plan.accounts[1]!.balance = '10000'
    plan.phases.push({
      id: 'next',
      label: 'Next',
      person: 'primary',
      years: '40',
      months: '1',
      changes: {},
    })
    plan.taxes!.phaseRates.next = { ordinaryRate: '0' }
    expect(inheritedTaxRates(plan, 1).ordinaryRate).toBe('20')
    expect(inheritedTaxRates(plan, 2).ordinaryRate).toBe('0')
    const outcome = evaluateProjection(plan)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors))
    expect(
      outcome.projection.taxes!.monthly.map((row) => row.taxPaidCents),
    ).toEqual([25_000, 0, 0])
  })

  it('preserves tax drafts when toggled off and copies them independently', () => {
    const plan = example()
    const model = taxEditor(plan, (edit) => edit(plan), [])
    model.fields[0]!.onChange('24')
    model.toggle(false)
    expect(plan.taxes!.ordinaryRate).toBe('24')
    expect(parseTaxDraft(plan, [])).toBeUndefined()
    model.toggle(true)
    const copy = copyPlan(plan, 'copy')
    copy.taxes!.ordinaryRate = '10'
    expect(plan.taxes!.ordinaryRate).toBe('24')
    const errors = [{ path: 'taxes.ordinaryRate', message: 'Required rate.' }]
    expect(taxEditor(plan, (edit) => edit(plan), errors).fields[0]!.error).toBe(
      'Required rate.',
    )
  })

  it('cleans removed account and phase references without altering the original copy', () => {
    const plan = example()
    plan.taxes!.accounts.workplace = accountTaxDraft()
    plan.phases.push({
      id: 'later',
      label: 'Later',
      person: 'primary',
      years: '60',
      months: '0',
      changes: {},
    })
    plan.taxes!.phaseRates.later = { ordinaryRate: '15' }
    const copy = copyPlan(plan, 'copy')
    removeAccount(copy, 'workplace')
    removePhase(copy, 'later')
    expect(copy.taxes!.accounts.workplace).toBeUndefined()
    expect(copy.taxes!.phaseRates.later).toBeUndefined()
    expect(plan.taxes!.accounts.workplace).toBeDefined()
    expect(plan.taxes!.phaseRates.later).toBeDefined()
  })

  it('keeps phase override controls optional and uses inherited values when enabled', () => {
    const plan = example()
    const model = taxEditor(plan, (edit) => edit(plan), [])
    expect(model.phases[0]!.rates[0]!.enabled).toBe(false)
    model.phases[0]!.rates[0]!.toggle(true)
    expect(plan.taxes!.phaseRates.start!.ordinaryRate).toBe('20')
    taxEditor(
      plan,
      (edit) => edit(plan),
      [],
    ).phases[0]!.rates[0]!.fields[0]!.onChange('0')
    expect(plan.taxes!.phaseRates.start!.ordinaryRate).toBe('0')
    model.phases[0]!.rates[0]!.toggle(false)
    expect(plan.taxes!.phaseRates.start!.ordinaryRate).toBeUndefined()
  })
})
