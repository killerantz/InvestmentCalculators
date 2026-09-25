import { describe, expect, it } from 'vitest'
import {
  runPlanProjection,
  type AccountKind,
  type AccountSettings,
  type PlanAccount,
  type PlanPhase,
  type PlanProjection,
  type PlanProjectionInput,
  type PlanTaxAssumptions,
  type PlanTaxProjection,
} from './index'

function account(
  id: string,
  kind: AccountKind,
  startingBalanceCents: number,
  settings: Partial<AccountSettings> = {},
): PlanAccount {
  return {
    id,
    label: id,
    kind,
    owner: 'primary',
    startingBalanceCents,
    settings: {
      monthlyContributionCents: 0,
      monthlyWithdrawalCents: 0,
      annualFeeRate: 0,
      rate: { kind: 'effective', annualRate: 0 },
      ...settings,
    },
  }
}

function phase(id: string, offset = 0): PlanPhase {
  return {
    id,
    label: id,
    start: offset
      ? { kind: 'age', person: 'primary', ageMonths: 720 + offset }
      : { kind: 'plan-start' },
    changes: [],
  }
}

function assumptions(
  overrides: Partial<PlanTaxAssumptions> = {},
): PlanTaxAssumptions {
  return {
    ordinaryRate: 0.2,
    capitalGainsRate: 0.2,
    qualifiedDividendRate: 0.1,
    accounts: [],
    incomes: [],
    phaseRates: [],
    ...overrides,
  }
}

function input(
  accounts: PlanAccount[] = [account('ira', 'traditional-ira', 1_000_000)],
  taxOverrides: Partial<PlanTaxAssumptions> = {},
): PlanProjectionInput {
  return {
    schedule: {
      startMonth: '2025-07',
      horizonMonths: 1,
      primaryAgeMonths: 720,
      partnerAgeMonths: 720,
      accounts: [account('cash', 'savings', 0), ...accounts],
      phases: [phase('now')],
    },
    incomes: [],
    cashAccountId: 'cash',
    monthlySpendingCents: 0,
    withdrawalOrder: ['cash', ...accounts.map((account) => account.id)],
    phaseChanges: [],
    annualInflationRate: 0,
    taxes: assumptions(taxOverrides),
  }
}

function brokerage(
  balance = 200_000,
  basis = 100_000,
  settings: Partial<AccountSettings> = {},
): PlanProjectionInput {
  return input([account('broker', 'taxable', balance, settings)], {
    accounts: [
      {
        accountId: 'broker',
        costBasisCents: basis,
        annualDividendYield: 0,
        qualifiedDividendShare: 0,
      },
    ],
  })
}

function project(
  value: unknown,
): PlanProjection & { taxes: PlanTaxProjection } {
  const result = runPlanProjection(value)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  if (!result.projection.taxes) throw new Error('Missing tax report.')
  return { ...result.projection, taxes: result.projection.taxes }
}

function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (row === undefined) throw new Error('Missing first row.')
  return row
}

function conservation(
  projection: PlanProjection & { taxes: PlanTaxProjection },
) {
  projection.monthly.forEach((row, index) => {
    const tax = projection.taxes.monthly[index]
    if (!tax) throw new Error('Missing tax month.')
    expect(row.closingBalanceCents).toBe(
      row.openingBalanceCents +
        row.externalContributionsCents +
        row.growthCents -
        row.feesCents +
        row.incomeCents -
        row.spendingCents -
        tax.taxPaidCents,
    )
    expect(tax.taxAssessedCents).toBe(
      tax.ordinaryTaxCents +
        tax.capitalGainsTaxCents +
        tax.qualifiedDividendTaxCents,
    )
    expect(tax.unpaidTaxCents).toBe(
      (projection.taxes.monthly[index - 1]?.unpaidTaxCents ?? 0) +
        tax.taxAssessedCents -
        tax.taxPaidCents,
    )
    for (const account of row.accounts) {
      expect(account.closingBalanceCents).toBeGreaterThanOrEqual(0)
      expect(account.closingBalanceCents).toBe(
        account.openingBalanceCents +
          account.growthCents -
          account.feesCents +
          account.externalContributionsCents -
          account.scheduledWithdrawalsCents +
          account.transfersInCents -
          account.transfersOutCents -
          account.automaticWithdrawalsCents +
          account.surplusDepositsCents,
      )
    }
  })
}

describe('separate tax payment orders', () => {
  it('conserves cents with overlapping orders, tiny balances, and near-total tax rates', () => {
    for (const ordinaryRate of [0, 0.2, 0.99, 1])
      for (const balance of [1, 7, 49])
        for (const spending of [1, 8, 50]) {
          const value = input([account('ira', 'traditional-ira', balance)], {
            paymentOrder: ['cash', 'ira'],
            ordinaryRate,
          })
          value.schedule.accounts[0]!.startingBalanceCents = 3
          value.monthlySpendingCents = spending
          value.withdrawalOrder = ['ira', 'cash']
          const result = project(value)
          expect(result.totals.spendingCents).toBeLessThanOrEqual(spending)
          conservation(result)
        }
  })

  it('uses cash for tax and an IRA for spending without changing legacy defaults', () => {
    const value = input()
    value.schedule.accounts[0]!.startingBalanceCents = 100_000
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    const original = project(value)
    expect(
      first(original.monthly).accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([0, 125_000])
    value.taxes = { ...value.taxes!, paymentOrder: ['cash'] }
    const result = project(value)
    expect(
      first(result.monthly).accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([20_000, 100_000])
    expect(result.taxes.totals.taxPaidCents).toBe(20_000)
    expect(result.totals.spendingCents).toBe(100_000)
    conservation(result)
  })

  it('uses preferred accounts in order, then falls back to spending accounts including their own taxes', () => {
    const value = input(
      [
        account('ira', 'traditional-ira', 1_000_000),
        account('broker', 'taxable', 10_000),
      ],
      {
        paymentOrder: ['cash', 'broker'],
        accounts: [
          {
            accountId: 'broker',
            costBasisCents: 10_000,
            annualDividendYield: 0,
            qualifiedDividendShare: 0,
          },
        ],
      },
    )
    value.schedule.accounts[0]!.startingBalanceCents = 5_000
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    const result = project(value)
    expect(
      first(result.monthly).accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([5_000, 106_250, 10_000])
    expect(result.taxes.totals.taxPaidCents).toBe(21_250)
    expect(result.totals.shortfallCents).toBe(0)
    conservation(result)
  })

  it('grosses up brokerage tax payments without losing pooled basis', () => {
    const value = input(
      [
        account('ira', 'traditional-ira', 1_000_000),
        account('broker', 'taxable', 200_000),
      ],
      {
        paymentOrder: ['broker'],
        accounts: [
          {
            accountId: 'broker',
            costBasisCents: 100_000,
            annualDividendYield: 0,
            qualifiedDividendShare: 0,
          },
        ],
      },
    )
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    const result = project(value)
    expect(
      first(result.monthly).accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([0, 100_000, 22_222])
    expect(result.taxes.totals.taxPaidCents).toBe(22_222)
    expect(
      first(result.taxes.monthly).accounts.find(
        (row) => row.accountId === 'broker',
      )!.closingBasisCents,
    ).toBe(88_889)
    conservation(result)
  })

  it('never uses tax-only accounts to cover a spending shortfall', () => {
    const value = input([account('ira', 'traditional-ira', 50_000)], {
      paymentOrder: ['cash'],
    })
    value.schedule.accounts[0]!.startingBalanceCents = 1_000_000
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    const result = project(value)
    expect(
      first(result.monthly).accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([10_000, 50_000])
    expect(result.totals).toMatchObject({
      spendingCents: 50_000,
      shortfallCents: 50_000,
    })
    conservation(result)
  })

  it('uses income and scheduled withdrawals before taking extra tax withdrawals', () => {
    const value = input(
      [
        account('ira', 'traditional-ira', 1_000_000, {
          monthlyWithdrawalCents: 120_000,
        }),
      ],
      { paymentOrder: ['cash'] },
    )
    value.schedule.accounts[0]!.startingBalanceCents = 100_000
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    const result = project(value)
    expect(
      first(result.monthly).accounts.map(
        (row) => row.automaticWithdrawalsCents,
      ),
    ).toEqual([800, 4_000])
    expect(result.taxes.totals.taxPaidCents).toBe(24_800)
    conservation(result)
    value.incomes = [
      {
        id: 'pension',
        person: 'primary',
        label: 'Pension',
        kind: 'pension',
        startAgeMonths: 720,
        monthlyAmountCents: 100_000,
        annualIncreaseRate: 0,
      },
    ]
    value.taxes = {
      ...value.taxes!,
      incomes: [{ incomeId: 'pension', taxableShare: 1 }],
    }
    const withIncome = project(value)
    expect(withIncome.totals.automaticWithdrawalsCents).toBe(0)
    conservation(withIncome)
  })

  it('inherits custom orders and can resume following changing spending orders', () => {
    const value = input(undefined, {
      paymentOrder: ['cash'],
      phaseRates: [
        { phaseId: 'follow', paymentOrder: null },
        { phaseId: 'custom', paymentOrder: ['cash'] },
      ],
    })
    value.schedule.accounts[0]!.startingBalanceCents = 1_000_000
    value.schedule.horizonMonths = 5
    value.schedule.phases = [
      phase('now'),
      phase('follow', 1),
      phase('change-spending', 2),
      phase('custom', 3),
      phase('carried', 4),
    ]
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    value.phaseChanges = [
      { phaseId: 'change-spending', withdrawalOrder: ['cash'] },
      { phaseId: 'custom', withdrawalOrder: ['ira'] },
    ]
    const result = project(value)
    expect(result.taxes.monthly.map((row) => row.taxPaidCents)).toEqual([
      20_000, 25_000, 0, 20_000, 20_000,
    ])
    conservation(result)
  })

  it('handles empty preferred orders and 100% tax exhaustion without an unbounded loop', () => {
    const value = input(undefined, { paymentOrder: [] })
    value.withdrawalOrder = ['ira']
    value.monthlySpendingCents = 100_000
    expect(project(value).totals.automaticWithdrawalsCents).toBe(125_000)
    value.taxes = {
      ...value.taxes!,
      ordinaryRate: 1,
      paymentOrder: ['cash', 'ira'],
    }
    value.schedule.accounts[0]!.startingBalanceCents = 5_000
    const result = project(value)
    expect(result.totals).toMatchObject({
      spendingCents: 5_000,
      shortfallCents: 95_000,
      closingBalanceCents: 0,
    })
    conservation(result)
  })

  it('funds an existing tax bill first and carries unpaid liability when all sources run out', () => {
    const value = input(
      [
        account('ira', 'traditional-ira', 100_000),
        account('roth', 'roth-ira', 0),
      ],
      { paymentOrder: ['cash'] },
    )
    value.schedule.accounts[0]!.startingBalanceCents = 5_000
    value.monthlySpendingCents = 100_000
    value.withdrawalOrder = ['ira']
    value.transfers = [
      {
        id: 'conversion',
        phaseId: 'now',
        kind: 'roth-conversion',
        sourceAccountId: 'ira',
        destinationAccountId: 'roth',
        monthlyAmountCents: 100_000,
      },
    ]
    const result = project(value)
    expect(result.taxes.totals).toMatchObject({
      taxPaidCents: 5_000,
      unpaidTaxCents: 15_000,
    })
    expect(result.totals.spendingCents).toBe(0)
    conservation(result)
  })

  it.each([null, undefined, {}, ['missing'], ['cash', 'cash'], [1]])(
    'rejects invalid preferred order %j',
    (order) => {
      const value = input()
      const result = runPlanProjection({
        ...value,
        taxes: { ...value.taxes, paymentOrder: order },
      })
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(
          result.errors.some((error) =>
            error.path.startsWith('taxes.paymentOrder'),
          ),
        ).toBe(true)
      const phaseResult = runPlanProjection({
        ...value,
        taxes: {
          ...value.taxes,
          phaseRates: [{ phaseId: 'now', paymentOrder: order }],
        },
      })
      if (order === null) expect(phaseResult.ok).toBe(true)
      else {
        expect(phaseResult.ok).toBe(false)
        if (!phaseResult.ok)
          expect(
            phaseResult.errors.some((error) =>
              error.path.startsWith('taxes.phaseRates.0.paymentOrder'),
            ),
          ).toBe(true)
      }
    },
  )
})

describe('optional estimated planning taxes', () => {
  it('withdraws exactly 125000 gross IRA cents to fund 100000 at 20%', () => {
    const value = input()
    value.monthlySpendingCents = 100_000
    const result = project(value)
    expect(first(result.monthly).automaticWithdrawalsCents).toBe(125_000)
    expect(result.taxes.totals).toMatchObject({
      ordinaryIncomeCents: 125_000,
      ordinaryTaxCents: 25_000,
      taxAssessedCents: 25_000,
      taxPaidCents: 25_000,
      unpaidTaxCents: 0,
    })
    expect(result.totals.closingBalanceCents).toBe(875_000)
    expect(result.totals.spendingCents).toBe(100_000)
    conservation(result)
  })

  it('keeps the original disabled result and all existing amount shapes', () => {
    const value = input()
    value.monthlySpendingCents = 100_000
    const { taxes: omitted, ...disabled } = value
    expect(omitted).toBeDefined()
    const result = runPlanProjection(disabled)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.projection).not.toHaveProperty('taxes')
    expect(result.projection.totals.automaticWithdrawalsCents).toBe(100_000)
    const zero = project({
      ...disabled,
      taxes: assumptions({
        ordinaryRate: 0,
        capitalGainsRate: 0,
        qualifiedDividendRate: 0,
      }),
    })
    const { taxes, ...withoutReport } = zero
    expect(taxes.totals.taxAssessedCents).toBe(0)
    expect(withoutReport).toEqual(result.projection)
  })

  it('grosses up brokerage sales and removes proportional pooled basis', () => {
    const value = brokerage()
    value.monthlySpendingCents = 90_000
    const result = project(value)
    expect(result.totals.automaticWithdrawalsCents).toBe(100_000)
    expect(result.taxes.totals).toMatchObject({
      capitalGainsCents: 50_000,
      capitalGainsTaxCents: 10_000,
      taxPaidCents: 10_000,
    })
    expect(first(result.taxes.monthly).accounts[1]).toMatchObject({
      openingBasisCents: 100_000,
      closingBasisCents: 50_000,
      realizedGainsCents: 50_000,
    })
    conservation(result)
  })

  it('tracks losses and permits basis above value without tax credits', () => {
    const value = brokerage(100_000, 150_000)
    value.monthlySpendingCents = 40_000
    const result = project(value)
    expect(result.taxes.totals.capitalGainsCents).toBe(-20_000)
    expect(result.taxes.totals.taxAssessedCents).toBe(0)
    expect(first(result.taxes.monthly).accounts[1]?.closingBasisCents).toBe(
      90_000,
    )
    conservation(result)
  })

  it('does not offset a positive sale with a loss in another account', () => {
    const value = input(
      [
        account('gain', 'taxable', 100_000, {
          monthlyWithdrawalCents: 100_000,
        }),
        account('loss', 'taxable', 100_000, {
          monthlyWithdrawalCents: 100_000,
        }),
      ],
      {
        accounts: [
          {
            accountId: 'gain',
            costBasisCents: 0,
            annualDividendYield: 0,
            qualifiedDividendShare: 0,
          },
          {
            accountId: 'loss',
            costBasisCents: 200_000,
            annualDividendYield: 0,
            qualifiedDividendShare: 0,
          },
        ],
      },
    )
    const result = project(value)
    expect(result.taxes.totals.capitalGainsCents).toBe(0)
    expect(result.taxes.totals.capitalGainsTaxCents).toBe(20_000)
    expect(result.totals.surplusDepositsCents).toBe(180_000)
    expect(
      first(result.taxes.monthly)
        .accounts.slice(1)
        .map((a) => a.closingBasisCents),
    ).toEqual([0, 0])
    conservation(result)
  })

  it('estimates reinvested dividends without adding growth or cash twice', () => {
    const value = brokerage(120_000, 100_000, {
      rate: { kind: 'effective', annualRate: Math.pow(1.01, 12) - 1 },
    })
    value.withdrawalOrder = []
    value.taxes = assumptions({
      accounts: [
        {
          accountId: 'broker',
          costBasisCents: 100_000,
          annualDividendYield: 0.12,
          qualifiedDividendShare: 0.75,
        },
      ],
    })
    const result = project(value)
    expect(result.totals.growthCents).toBe(1_200)
    expect(result.totals.closingBalanceCents).toBe(121_200)
    expect(result.taxes.totals).toMatchObject({
      ordinaryIncomeCents: 300,
      ordinaryDividendsCents: 300,
      qualifiedDividendsCents: 900,
      ordinaryTaxCents: 60,
      qualifiedDividendTaxCents: 90,
      taxAssessedCents: 150,
      taxPaidCents: 0,
      unpaidTaxCents: 150,
    })
    expect(first(result.taxes.monthly).accounts[1]?.closingBasisCents).toBe(
      101_200,
    )
    conservation(result)
  })

  it.each(['traditional-ira', 'traditional-401k'] as const)(
    'defers %s growth and does not deduct external contributions',
    (kind) => {
      const result = project(
        input([
          account('ira', kind, 120_000, {
            monthlyContributionCents: 10_000,
            rate: { kind: 'effective', annualRate: Math.pow(1.01, 12) - 1 },
          }),
        ]),
      )
      expect(result.totals.closingBalanceCents).toBe(131_200)
      expect(result.taxes.totals.ordinaryIncomeCents).toBe(0)
      expect(result.taxes.totals.taxAssessedCents).toBe(0)
      expect(
        first(result.taxes.monthly).accounts[1]?.closingBasisCents,
      ).toBeNull()
    },
  )

  it.each(['roth-ira', 'roth-401k'] as const)(
    'assumes qualified %s distributions are tax-free',
    (kind) => {
      const value = input([
        account('roth', kind, 100_000, {
          monthlyWithdrawalCents: 10_000,
        }),
      ])
      value.monthlySpendingCents = 50_000
      const result = project(value)
      expect(result.totals.automaticWithdrawalsCents).toBe(40_000)
      expect(result.taxes.totals.taxAssessedCents).toBe(0)
      conservation(result)
    },
  )

  it('taxes positive savings growth but not principal withdrawals', () => {
    const value = input([
      account('savings', 'savings', 100_000, {
        rate: { kind: 'effective', annualRate: Math.pow(1.01, 12) - 1 },
      }),
    ])
    value.monthlySpendingCents = 10_000
    const result = project(value)
    expect(result.taxes.totals.ordinaryIncomeCents).toBe(1_000)
    expect(result.taxes.totals.ordinaryTaxCents).toBe(200)
    expect(result.totals.automaticWithdrawalsCents).toBe(10_200)
    conservation(result)
  })

  it('never creates a credit for negative savings growth', () => {
    const value = input([
      account('savings', 'savings', 100_000, {
        rate: { kind: 'effective', annualRate: -0.5 },
      }),
    ])
    const result = project(value)
    expect(result.totals.growthCents).toBeLessThan(0)
    expect(result.taxes.totals.ordinaryTaxCents).toBe(0)
    expect(result.taxes.totals.ordinaryIncomeCents).toBe(0)
  })

  it('treats pension/SS payments as gross and honors entered taxable shares', () => {
    const value = input([], {
      incomes: [
        { incomeId: 'pension', taxableShare: 0.5 },
        { incomeId: 'ss', taxableShare: 0.85 },
      ],
    })
    value.incomes = [
      {
        id: 'pension',
        label: 'Pension',
        kind: 'pension',
        person: 'primary',
        startAgeMonths: 720,
        monthlyAmountCents: 10_000,
        annualIncreaseRate: 0,
      },
      {
        id: 'ss',
        label: 'SS',
        kind: 'social-security',
        person: 'primary',
        startAgeMonths: 720,
        monthlyAmountCents: 20_000,
        annualIncreaseRate: 0,
      },
    ]
    value.monthlySpendingCents = 20_000
    const result = project(value)
    expect(result.totals.incomeCents).toBe(30_000)
    expect(result.taxes.totals.ordinaryIncomeCents).toBe(22_000)
    expect(result.taxes.totals.taxPaidCents).toBe(4_400)
    expect(result.totals.surplusDepositsCents).toBe(5_600)
    conservation(result)
  })

  it('inherits phase rates and preserves explicit zero', () => {
    const value = input(
      [
        account('ira', 'traditional-ira', 100_000, {
          monthlyWithdrawalCents: 1_000,
        }),
      ],
      {
        phaseRates: [
          { phaseId: 'second', ordinaryRate: 0 },
          { phaseId: 'third', capitalGainsRate: 0.5 },
        ],
      },
    )
    value.schedule.horizonMonths = 3
    value.schedule.phases = [
      phase('now'),
      phase('second', 1),
      phase('third', 2),
    ]
    const result = project(value)
    expect(result.taxes.monthly.map((row) => row.ordinaryTaxCents)).toEqual([
      200, 0, 0,
    ])
  })

  it('taxes scheduled traditional withdrawals before household spending', () => {
    const value = input([
      account('ira', 'traditional-ira', 100_000, {
        monthlyWithdrawalCents: 100_000,
      }),
    ])
    value.monthlySpendingCents = 100_000
    const result = project(value)
    expect(result.totals.spendingCents).toBe(80_000)
    expect(result.totals.shortfallCents).toBe(20_000)
    expect(result.totals.scheduledWithdrawalShortfallCents).toBe(0)
    expect(result.taxes.totals.unpaidTaxCents).toBe(0)
    expect(result.firstShortfallMonth).toBe(1)
    conservation(result)
  })

  it('taxes conversion principal once and grosses up IRA funding for its tax', () => {
    const value = input([
      account('ira', 'traditional-ira', 200_000),
      account('roth', 'roth-ira', 0),
    ])
    value.withdrawalOrder = ['ira']
    value.transfers = [
      {
        id: 'convert',
        phaseId: 'now',
        kind: 'roth-conversion',
        sourceAccountId: 'ira',
        destinationAccountId: 'roth',
        monthlyAmountCents: 100_000,
      },
    ]
    const result = project(value)
    expect(result.totals.rothConversionsOutCents).toBe(100_000)
    expect(result.totals.automaticWithdrawalsCents).toBe(25_000)
    expect(result.taxes.totals.ordinaryIncomeCents).toBe(125_000)
    expect(result.taxes.totals.taxPaidCents).toBe(25_000)
    expect(result.totals.closingBalanceCents).toBe(175_000)
    conservation(result)
  })

  it.each([
    ['traditional-401k', 'primary', 0],
    ['traditional-401k', 'partner', 20_000],
    ['savings', 'primary', 20_000],
    ['roth-ira', 'primary', 20_000],
  ] as const)(
    'applies rollover treatment for %s owned by %s',
    (kind, owner, tax) => {
      const destination = { ...account('destination', kind, 0), owner }
      const value = input([
        account('ira', 'traditional-ira', 100_000),
        destination,
      ])
      value.withdrawalOrder = []
      value.transfers = [
        {
          id: 'move',
          phaseId: 'now',
          kind: 'transfer',
          sourceAccountId: 'ira',
          destinationAccountId: 'destination',
          monthlyAmountCents: 100_000,
        },
      ]
      const result = project(value)
      expect(result.taxes.totals.taxAssessedCents).toBe(tax)
      expect(result.taxes.totals.unpaidTaxCents).toBe(tax)
      conservation(result)
    },
  )

  it('taxes brokerage transfers as sales and adds destination basis', () => {
    const value = brokerage(100_000, 50_000)
    value.schedule.accounts = [
      ...value.schedule.accounts,
      account('other', 'taxable', 0),
    ]
    value.taxes = assumptions({
      accounts: [
        {
          accountId: 'broker',
          costBasisCents: 50_000,
          annualDividendYield: 0,
          qualifiedDividendShare: 0,
        },
        {
          accountId: 'other',
          costBasisCents: 0,
          annualDividendYield: 0,
          qualifiedDividendShare: 0,
        },
      ],
    })
    value.withdrawalOrder = []
    value.transfers = [
      {
        id: 'move',
        phaseId: 'now',
        kind: 'transfer',
        sourceAccountId: 'broker',
        destinationAccountId: 'other',
        monthlyAmountCents: 40_000,
      },
    ]
    const result = project(value)
    expect(result.taxes.totals.capitalGainsCents).toBe(20_000)
    expect(result.taxes.totals.taxAssessedCents).toBe(4_000)
    expect(
      first(result.taxes.monthly)
        .accounts.slice(1)
        .map((a) => a.closingBasisCents),
    ).toEqual([30_000, 40_000])
    conservation(result)
  })

  it('adds external contributions to basis but not growth or fees', () => {
    const value = brokerage(100_000, 80_000, {
      monthlyContributionCents: 20_000,
      annualFeeRate: 0.12,
      rate: { kind: 'effective', annualRate: Math.pow(1.01, 12) - 1 },
    })
    const result = project(value)
    expect(first(result.taxes.monthly).accounts[1]?.closingBasisCents).toBe(
      100_000,
    )
    expect(result.totals.closingBalanceCents).toBe(119_990)
  })

  it('carries unpaid taxes and pays prior liability before new spending', () => {
    const value = input(
      [
        account('ira', 'traditional-ira', 100_000),
        account('roth', 'roth-ira', 0),
      ],
      { incomes: [{ incomeId: 'pension', taxableShare: 0 }] },
    )
    value.schedule.horizonMonths = 3
    value.incomes = [
      {
        id: 'pension',
        label: 'Pension',
        kind: 'pension',
        person: 'primary',
        startAgeMonths: 721,
        monthlyAmountCents: 15_000,
        annualIncreaseRate: 0,
      },
    ]
    value.withdrawalOrder = []
    value.monthlySpendingCents = 5_000
    value.transfers = [
      {
        id: 'convert',
        phaseId: 'now',
        kind: 'roth-conversion',
        sourceAccountId: 'ira',
        destinationAccountId: 'roth',
        monthlyAmountCents: 100_000,
      },
    ]
    const result = project(value)
    expect(result.taxes.monthly.map((row) => row.taxAssessedCents)).toEqual([
      20_000, 0, 0,
    ])
    expect(result.taxes.monthly.map((row) => row.taxPaidCents)).toEqual([
      0, 15_000, 5_000,
    ])
    expect(result.taxes.monthly.map((row) => row.unpaidTaxCents)).toEqual([
      20_000, 5_000, 0,
    ])
    expect(result.monthly.map((row) => row.shortfallCents)).toEqual([
      5_000, 5_000, 0,
    ])
    expect(result.taxes.totals.unpaidTaxCents).toBe(0)
    conservation(result)
  })

  it('handles 100% tax rates, exhaustion and meaningful spending shortfall', () => {
    const value = input([account('ira', 'traditional-ira', 100_000)], {
      ordinaryRate: 1,
    })
    value.monthlySpendingCents = 1
    const result = project(value)
    expect(result.totals.automaticWithdrawalsCents).toBe(100_000)
    expect(result.taxes.totals.taxPaidCents).toBe(100_000)
    expect(result.totals.shortfallCents).toBe(1)
    expect(result.totals.closingBalanceCents).toBe(0)
    conservation(result)
  })

  it('respects eligible withdrawal order, including later phase changes', () => {
    const value = input([
      account('ira', 'traditional-ira', 100_000),
      account('roth', 'roth-ira', 100_000),
    ])
    value.schedule.horizonMonths = 2
    value.schedule.phases = [phase('now'), phase('later', 1)]
    value.withdrawalOrder = []
    value.phaseChanges = [
      { phaseId: 'later', withdrawalOrder: ['roth', 'ira'] },
    ]
    value.monthlySpendingCents = 10_000
    const result = project(value)
    expect(result.monthly.map((row) => row.shortfallCents)).toEqual([10_000, 0])
    expect(result.taxes.totals.taxAssessedCents).toBe(0)
    expect(result.monthly[1]?.accounts[2]?.automaticWithdrawalsCents).toBe(
      10_000,
    )
  })

  it('reports projection-year tax flows and closing liability snapshots', () => {
    const value = brokerage(120_000, 100_000)
    value.schedule.horizonMonths = 14
    value.withdrawalOrder = []
    value.taxes = assumptions({
      accounts: [
        {
          accountId: 'broker',
          costBasisCents: 100_000,
          annualDividendYield: 0.12,
          qualifiedDividendShare: 0,
        },
      ],
    })
    const result = project(value)
    expect(
      result.taxes.annual.map((row) => [
        row.year,
        row.startMonth,
        row.endMonth,
      ]),
    ).toEqual([
      [1, 1, 12],
      [2, 13, 14],
    ])
    expect(result.taxes.annual.map((row) => row.taxAssessedCents)).toEqual([
      2_880, 480,
    ])
    expect(result.taxes.annual.map((row) => row.unpaidTaxCents)).toEqual([
      2_880, 3_360,
    ])
    expect(result.taxes.totals.unpaidTaxCents).toBe(3_360)
    conservation(result)
  })

  it('uses post-tax December closing balances for next-year percentage transfers', () => {
    const value = input([
      {
        ...account('ira', 'traditional-ira', 200_000),
        priorYearEndBalanceCents: 120_000,
      },
      account('roth', 'roth-ira', 0),
    ])
    value.schedule.startMonth = '2025-12'
    value.schedule.horizonMonths = 2
    value.withdrawalOrder = ['ira']
    value.transfers = [
      {
        id: 'percent',
        phaseId: 'now',
        kind: 'roth-conversion',
        sourceAccountId: 'ira',
        destinationAccountId: 'roth',
        amountKind: 'annual-percentage',
        annualRate: 1,
      },
    ]
    const result = project(value)
    expect(result.monthly[0]?.accounts[1]?.closingBalanceCents).toBe(187_500)
    expect(result.monthly[1]?.transfers[0]?.referenceBalanceCents).toBe(187_500)
    conservation(result)
  })

  it('matches exhaustive minimal gross-up at cent-level rounding boundaries', () => {
    for (const rate of [0, 0.01, 0.2, 0.5, 0.85, 0.99, 1]) {
      for (const spending of [1, 2, 7, 19]) {
        const value = input([account('ira', 'traditional-ira', 250)], {
          ordinaryRate: rate,
        })
        value.monthlySpendingCents = spending
        const result = project(value)
        const candidates = Array.from({ length: 251 }, (_, i) => i)
        const expected =
          candidates.find(
            (gross) => gross - Math.round(gross * rate) >= spending,
          ) ?? 250
        expect(result.totals.automaticWithdrawalsCents).toBe(expected)
        conservation(result)
      }
    }
  })

  it('matches exhaustive brokerage gross-up with pooled-basis cent rounding', () => {
    for (const basis of [0, 1, 33, 99, 100, 150]) {
      for (const rate of [0.2, 0.5, 1]) {
        const value = brokerage(100, basis)
        value.taxes = assumptions({
          ...value.taxes,
          capitalGainsRate: rate,
        })
        value.monthlySpendingCents = 19
        const result = project(value)
        const expected =
          Array.from({ length: 101 }, (_, i) => i).find(
            (gross) =>
              gross -
                Math.round(
                  Math.max(0, gross - Math.round((basis * gross) / 100)) * rate,
                ) >=
              19,
          ) ?? 100
        expect(result.totals.automaticWithdrawalsCents).toBe(expected)
        conservation(result)
      }
    }
  })

  it('uses safe proportional basis arithmetic at maximum-safe cents', () => {
    const value = brokerage(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
    value.monthlySpendingCents = 101
    const result = project(value)
    expect(result.taxes.totals.capitalGainsCents).toBe(0)
    expect(first(result.taxes.monthly).accounts[1]?.closingBasisCents).toBe(
      Number.MAX_SAFE_INTEGER - 101,
    )
  })

  it('rejects basis overflow from reinvested distributions', () => {
    const value = brokerage(120_000, Number.MAX_SAFE_INTEGER)
    value.taxes = assumptions({
      accounts: [
        {
          accountId: 'broker',
          costBasisCents: Number.MAX_SAFE_INTEGER,
          annualDividendYield: 0.12,
          qualifiedDividendShare: 0,
        },
      ],
    })
    const result = runPlanProjection(value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.path).toBe('calculation')
  })
})

describe('tax assumption validation', () => {
  function errors(value: unknown): readonly string[] {
    const result = runPlanProjection(value)
    expect(result.ok).toBe(false)
    return result.ok ? [] : result.errors.map((issue) => issue.path)
  }

  it.each([undefined, null, false, [], 'taxes'])(
    'rejects an invalid tax object: %s',
    (taxes) => {
      expect(errors({ ...input(), taxes })).toContain('taxes')
    },
  )

  it.each([
    'ordinaryRate',
    'capitalGainsRate',
    'qualifiedDividendRate',
  ] as const)('requires a finite 0–1 %s', (key) => {
    for (const invalid of [undefined, -0.01, 1.01, NaN, Infinity, '0.2']) {
      expect(
        errors({ ...input(), taxes: { ...assumptions(), [key]: invalid } }),
      ).toContain(`taxes.${key}`)
    }
  })

  it.each(['accounts', 'incomes', 'phaseRates'] as const)(
    'requires the %s array',
    (key) => {
      expect(
        errors({ ...input(), taxes: { ...assumptions(), [key]: undefined } }),
      ).toContain(`taxes.${key}`)
    },
  )

  it('rejects aggregate tax treatment', () => {
    const value = input([])
    value.schedule.accounts = [account('cash', 'aggregate', 100)]
    expect(errors(value)).toContain('accounts.0.kind')
  })

  it('requires every brokerage and rejects non-brokerage, unknown, duplicate references', () => {
    const value = brokerage()
    expect(errors({ ...value, taxes: assumptions() })).toContain(
      'taxes.accounts',
    )
    const row = {
      accountId: 'broker',
      costBasisCents: 100,
      annualDividendYield: 0,
      qualifiedDividendShare: 0,
    }
    for (const accountId of ['cash', 'missing']) {
      expect(
        errors({
          ...value,
          taxes: assumptions({ accounts: [{ ...row, accountId }] }),
        }),
      ).toContain('taxes.accounts.0.accountId')
    }
    expect(
      errors({ ...value, taxes: assumptions({ accounts: [row, row] }) }),
    ).toContain('taxes.accounts.1.accountId')
  })

  it('rejects invalid basis, dividend yield and qualified shares', () => {
    const value = brokerage()
    const row = {
      accountId: 'broker',
      costBasisCents: 100,
      annualDividendYield: 0,
      qualifiedDividendShare: 0,
    }
    for (const costBasisCents of [
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Infinity,
    ]) {
      expect(
        errors({
          ...value,
          taxes: assumptions({ accounts: [{ ...row, costBasisCents }] }),
        }),
      ).toContain('taxes.accounts.0.costBasisCents')
    }
    for (const key of [
      'annualDividendYield',
      'qualifiedDividendShare',
    ] as const)
      for (const bad of [-0.1, 1.1, undefined, NaN])
        expect(
          errors({
            ...value,
            taxes: assumptions({ accounts: [{ ...row, [key]: bad }] }),
          }),
        ).toContain(`taxes.accounts.0.${key}`)
  })

  it('requires every income and enforces SS shares no higher than 85%', () => {
    const value = input()
    value.incomes = [
      {
        id: 'ss',
        label: 'SS',
        kind: 'social-security',
        person: 'primary',
        startAgeMonths: 720,
        monthlyAmountCents: 100,
        annualIncreaseRate: 0,
      },
    ]
    expect(errors(value)).toContain('taxes.incomes')
    for (const taxableShare of [-0.1, 0.851, 1, NaN])
      expect(
        errors({
          ...value,
          taxes: assumptions({ incomes: [{ incomeId: 'ss', taxableShare }] }),
        }),
      ).toContain('taxes.incomes.0.taxableShare')
    expect(
      errors({
        ...value,
        taxes: assumptions({
          incomes: [{ incomeId: 'missing', taxableShare: 0 }],
        }),
      }),
    ).toContain('taxes.incomes.0.incomeId')
    expect(
      errors({
        ...value,
        taxes: assumptions({
          incomes: [
            { incomeId: 'ss', taxableShare: 0 },
            { incomeId: 'ss', taxableShare: 0 },
          ],
        }),
      }),
    ).toContain('taxes.incomes.1.incomeId')
    expect(
      project({
        ...value,
        taxes: assumptions({ incomes: [{ incomeId: 'ss', taxableShare: 0 }] }),
      }).taxes.totals.taxAssessedCents,
    ).toBe(0)
  })

  it('validates phase references, duplicates, explicit undefined and bounded overrides', () => {
    const value = input()
    expect(
      errors({
        ...value,
        taxes: assumptions({ phaseRates: [{ phaseId: 'missing' }] }),
      }),
    ).toContain('taxes.phaseRates.0.phaseId')
    expect(
      errors({
        ...value,
        taxes: assumptions({
          phaseRates: [{ phaseId: 'now' }, { phaseId: 'now' }],
        }),
      }),
    ).toContain('taxes.phaseRates.1.phaseId')
    for (const ordinaryRate of [undefined, -1, 1.1, NaN])
      expect(
        errors({
          ...value,
          taxes: {
            ...assumptions(),
            phaseRates: [{ phaseId: 'now', ordinaryRate }],
          },
        }),
      ).toContain('taxes.phaseRates.0.ordinaryRate')
  })

  it('rejects unknown fields at every tax level', () => {
    const value = brokerage()
    const row = {
      accountId: 'broker',
      costBasisCents: 100,
      annualDividendYield: 0,
      qualifiedDividendShare: 0,
    }
    expect(errors({ ...value, taxes: { ...value.taxes, extra: 0 } })).toContain(
      'taxes.extra',
    )
    expect(
      errors({
        ...value,
        taxes: { ...value.taxes, accounts: [{ ...row, extra: 0 }] },
      }),
    ).toContain('taxes.accounts.0.extra')
    expect(
      errors({
        ...value,
        taxes: {
          ...value.taxes,
          incomes: [{ incomeId: 'unknown', taxableShare: 0, extra: 0 }],
        },
      }),
    ).toContain('taxes.incomes.0.extra')
    expect(
      errors({
        ...value,
        taxes: { ...value.taxes, phaseRates: [{ phaseId: 'now', extra: 0 }] },
      }),
    ).toContain('taxes.phaseRates.0.extra')
  })
})
