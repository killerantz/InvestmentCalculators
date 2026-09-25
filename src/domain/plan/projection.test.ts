import { describe, expect, it } from 'vitest'
import { runGrowthProjection } from '../growth'
import {
  compilePlan,
  runPlanProjection,
  type AccountAmounts,
  type AccountSettings,
  type AccountTransfer,
  type IncomeStream,
  type PlanAccount,
  type PlanAmounts,
  type PlanPhase,
  type PlanProjection,
  type PlanProjectionInput,
  type PlanTransferRow,
} from './index'

function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`Missing item ${index}`)
  return item
}

function account(
  id = 'cash',
  startingBalanceCents = 10_000,
  settings: Partial<AccountSettings> = {},
): PlanAccount {
  return {
    id,
    label: id,
    kind: id === 'cash' ? 'savings' : 'traditional-ira',
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

function income(overrides: Partial<IncomeStream> = {}): IncomeStream {
  return {
    id: 'primary-ss',
    label: 'Primary Social Security',
    kind: 'social-security',
    person: 'primary',
    startAgeMonths: 720,
    monthlyAmountCents: 1_000,
    annualIncreaseRate: 0,
    ...overrides,
  }
}

function phase(id: string, offset: number): PlanPhase {
  return {
    id,
    label: id,
    start:
      offset === 0
        ? { kind: 'plan-start' }
        : { kind: 'age', person: 'primary', ageMonths: 720 + offset },
    changes: [],
  }
}

type MonthlyTransfer = Extract<AccountTransfer, { monthlyAmountCents: number }>

function transfer(overrides: Partial<MonthlyTransfer> = {}): MonthlyTransfer {
  return {
    id: 'move',
    phaseId: 'now',
    kind: 'transfer',
    sourceAccountId: 'ira',
    destinationAccountId: 'roth',
    monthlyAmountCents: 100,
    ...overrides,
  }
}

function transferInput(
  transfers: readonly AccountTransfer[] = [transfer()],
): PlanProjectionInput {
  const value = input({ transfers })
  value.schedule.horizonMonths = 1
  value.schedule.accounts = [
    account('cash', 0),
    account('ira', 1_000),
    { ...account('roth', 0), kind: 'roth-ira' },
  ]
  return value
}

type PercentageTransfer = Extract<
  AccountTransfer,
  { amountKind: 'annual-percentage' }
>

function percentageTransfer(
  overrides: Partial<PercentageTransfer> = {},
): PercentageTransfer {
  return {
    id: 'percentage',
    phaseId: 'now',
    kind: 'transfer',
    sourceAccountId: 'ira',
    destinationAccountId: 'roth',
    amountKind: 'annual-percentage',
    annualRate: 0.1,
    ...overrides,
  }
}

function percentageInput(
  transfers: readonly AccountTransfer[] = [percentageTransfer()],
): PlanProjectionInput {
  const value = transferInput(transfers)
  value.schedule.startMonth = '2025-01'
  value.schedule.horizonMonths = 12
  value.schedule.accounts = [
    account('cash', 0),
    { ...account('ira', 20_000), priorYearEndBalanceCents: 12_000 },
    { ...account('roth', 0), kind: 'roth-ira' },
  ]
  return value
}

function input(
  overrides: Partial<PlanProjectionInput> = {},
): PlanProjectionInput {
  return {
    schedule: {
      startMonth: '2024-12',
      horizonMonths: 24,
      primaryAgeMonths: 720,
      partnerAgeMonths: 696,
      accounts: [account()],
      phases: [phase('now', 0)],
    },
    incomes: [],
    cashAccountId: 'cash',
    monthlySpendingCents: 0,
    withdrawalOrder: ['cash'],
    phaseChanges: [],
    annualInflationRate: 0,
    ...overrides,
  }
}

function project(value: unknown = input()): PlanProjection {
  const result = runPlanProjection(value)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.projection
}

function rejected(value: unknown, path: string) {
  const result = runPlanProjection(value)
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('Expected rejection')
  expect(result).not.toHaveProperty('projection')
  expect(result.errors).toContainEqual({ path, message: expect.any(String) })
}

function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const item of Object.values(value)) freezeDeep(item)
  }
}

const accountFlows = [
  'externalContributionsCents',
  'scheduledWithdrawalsCents',
  'scheduledWithdrawalShortfallCents',
  'transfersInCents',
  'transfersOutCents',
  'transferShortfallCents',
  'rothConversionsInCents',
  'rothConversionsOutCents',
  'automaticWithdrawalsCents',
  'surplusDepositsCents',
  'growthCents',
  'feesCents',
  'realGrowthCents',
] as const
const accountFields = [
  'openingBalanceCents',
  ...accountFlows,
  'closingBalanceCents',
  'realClosingBalanceCents',
] as const
const flows = [
  ...accountFlows,
  'incomeCents',
  'requestedSpendingCents',
  'spendingCents',
  'shortfallCents',
] as const

function reconcileAccount(row: AccountAmounts) {
  expect(BigInt(row.closingBalanceCents)).toBe(
    BigInt(row.openingBalanceCents) +
      BigInt(row.externalContributionsCents) +
      BigInt(row.transfersInCents) -
      BigInt(row.transfersOutCents) +
      BigInt(row.growthCents) -
      BigInt(row.feesCents) -
      BigInt(row.scheduledWithdrawalsCents) -
      BigInt(row.automaticWithdrawalsCents) +
      BigInt(row.surplusDepositsCents),
  )
  expect(row.rothConversionsInCents).toBeLessThanOrEqual(row.transfersInCents)
  expect(row.rothConversionsOutCents).toBeLessThanOrEqual(row.transfersOutCents)
}

function reconcileHousehold(row: PlanAmounts) {
  reconcileAccount(row)
  expect(row.transfersInCents).toBe(row.transfersOutCents)
  expect(row.rothConversionsInCents).toBe(row.rothConversionsOutCents)
  expect(BigInt(row.closingBalanceCents)).toBe(
    BigInt(row.openingBalanceCents) +
      BigInt(row.externalContributionsCents) +
      BigInt(row.growthCents) -
      BigInt(row.feesCents) +
      BigInt(row.incomeCents) -
      BigInt(row.spendingCents),
  )
  expect(row.requestedSpendingCents).toBe(
    row.spendingCents + row.shortfallCents,
  )
  expect(
    row.incomeCents +
      row.scheduledWithdrawalsCents +
      row.automaticWithdrawalsCents,
  ).toBe(row.spendingCents + row.surplusDepositsCents)
}

describe('phased household financial projection', () => {
  it('exports the stable API, compiled schedule, calendar months and projection years', () => {
    const value = input()
    value.schedule.horizonMonths = 14
    const result = project(value)
    expect(result.engineVersion).toBe('plan-projection-1.5.0')
    const compiled = compilePlan(value.schedule)
    if (!compiled.ok) throw new Error('Expected compiled schedule')
    expect(result.schedule).toEqual(compiled.plan)
    expect(result.monthly.map((row) => row.calendarMonth)).toEqual([
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
    ])
    expect(
      result.annual.map(({ year, startMonth, endMonth }) => ({
        year,
        startMonth,
        endMonth,
      })),
    ).toEqual([
      { year: 1, startMonth: 1, endMonth: 12 },
      { year: 2, startMonth: 13, endMonth: 14 },
    ])
    expect(result.totals).toEqual({
      openingBalanceCents: 10_000,
      externalContributionsCents: 0,
      incomeCents: 0,
      requestedSpendingCents: 0,
      spendingCents: 0,
      shortfallCents: 0,
      scheduledWithdrawalsCents: 0,
      scheduledWithdrawalShortfallCents: 0,
      transfersInCents: 0,
      transfersOutCents: 0,
      transferShortfallCents: 0,
      rothConversionsInCents: 0,
      rothConversionsOutCents: 0,
      automaticWithdrawalsCents: 0,
      surplusDepositsCents: 0,
      growthCents: 0,
      feesCents: 0,
      closingBalanceCents: 10_000,
      realClosingBalanceCents: 10_000,
      realGrowthCents: 0,
    })
    expect(result.firstShortfallMonth).toBeNull()
  })

  it('starts partner streams on their own exact age offsets and anniversary months', () => {
    const result = project(
      input({
        incomes: [
          income({ startAgeMonths: 721, annualIncreaseRate: 0.1 }),
          income({
            id: 'partner-pension',
            label: 'Partner pension',
            person: 'partner',
            kind: 'pension',
            startAgeMonths: 699,
            monthlyAmountCents: 2_000,
            annualIncreaseRate: 0.2,
          }),
        ],
      }),
    )
    expect(
      result.monthly
        .slice(0, 5)
        .map((row) => row.incomes.map((stream) => stream.amountCents)),
    ).toEqual([
      [0, 0],
      [1_000, 0],
      [1_000, 0],
      [1_000, 2_000],
      [1_000, 2_000],
    ])
    expect(at(result.monthly, 12).incomeCents).toBe(3_000)
    expect(at(result.monthly, 13).incomeCents).toBe(3_100)
    expect(at(result.monthly, 14).incomeCents).toBe(3_100)
    expect(at(result.monthly, 15).incomeCents).toBe(3_500)
  })

  it('compounds pre-plan nominal payments from their original first payment, not plan start', () => {
    const result = project(
      input({
        incomes: [income({ startAgeMonths: 695, annualIncreaseRate: 0.1 })],
      }),
    )
    expect(at(result.monthly, 0).incomeCents).toBe(1_210)
    expect(at(result.monthly, 10).incomeCents).toBe(1_210)
    expect(at(result.monthly, 11).incomeCents).toBe(1_331)
    expect(at(result.monthly, 23).incomeCents).toBe(1_464)
  })

  it('rounds each anniversary payment from the original nominal amount, not the prior rounded payment', () => {
    const result = project(
      input({
        incomes: [
          income({
            monthlyAmountCents: 1,
            startAgeMonths: 696,
            annualIncreaseRate: 0.5,
          }),
        ],
      }),
    )
    expect(at(result.monthly, 0).incomeCents).toBe(2)
    expect(at(result.monthly, 12).incomeCents).toBe(3)
  })

  it('accepts age zero, first-month starts, and unused starts at or beyond the horizon', () => {
    const value = input({
      incomes: [
        income({ startAgeMonths: 0, annualIncreaseRate: 0 }),
        income({
          id: 'at-end',
          label: 'At horizon',
          startAgeMonths: 744,
          annualIncreaseRate: Number.MAX_VALUE,
        }),
        income({ id: 'later', label: 'Later', startAgeMonths: 1_800 }),
      ],
    })
    const result = project(value)
    expect(result.monthly.every((row) => row.incomeCents === 1_000)).toBe(true)
    expect(
      at(result.monthly, 23).incomes.map((stream) => stream.amountCents),
    ).toEqual([1_000, 0, 0])
  })

  it('keeps independent multiple streams for one person and permits uncapped finite increase rates', () => {
    const value = input({
      incomes: [
        income({ annualIncreaseRate: 2 }),
        income({
          id: 'pension',
          label: 'Pension',
          kind: 'pension',
          monthlyAmountCents: 500,
        }),
      ],
    })
    expect(at(project(value).monthly, 12).incomeCents).toBe(3_500)
  })

  it('applies boundary spending/order changes, omitted inheritance, explicit zero and empty order', () => {
    const value = input({
      monthlySpendingCents: 100,
      withdrawalOrder: ['cash', 'ira'],
      // Deliberately not in schedule order.
      phaseChanges: [
        { phaseId: 'empty', withdrawalOrder: [] },
        { phaseId: 'zero', monthlySpendingCents: 0 },
        {
          phaseId: 'reverse',
          monthlySpendingCents: 200,
          withdrawalOrder: ['ira', 'cash'],
        },
      ],
    })
    value.schedule.horizonMonths = 6
    value.schedule.accounts = [account('cash', 1_000), account('ira', 1_000)]
    value.schedule.phases = [
      phase('now', 0),
      phase('reverse', 1),
      phase('inherit', 2),
      phase('empty', 3),
      phase('zero', 4),
      phase('still-zero', 5),
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) =>
        row.accounts.map((a) => a.automaticWithdrawalsCents),
      ),
    ).toEqual([
      [100, 0],
      [0, 200],
      [0, 200],
      [0, 0],
      [0, 0],
      [0, 0],
    ])
    expect(result.monthly.map((row) => row.requestedSpendingCents)).toEqual([
      100, 200, 200, 200, 0, 0,
    ])
    expect(result.monthly.map((row) => row.shortfallCents)).toEqual([
      0, 0, 0, 200, 0, 0,
    ])
    expect(result.firstShortfallMonth).toBe(4)
  })

  it('honors the initial phase override and compiled account settings on the same month boundary', () => {
    const value = input({
      monthlySpendingCents: 999,
      phaseChanges: [{ phaseId: 'now', monthlySpendingCents: 100 }],
    })
    value.schedule.horizonMonths = 2
    value.schedule.accounts = [
      account('cash', 0, { monthlyContributionCents: 50 }),
    ]
    value.schedule.phases = [
      phase('now', 0),
      {
        ...phase('next', 1),
        changes: [{ accountId: 'cash', monthlyContributionCents: 100 }],
      },
    ]
    expect(
      project(value).monthly.map((row) => [
        row.externalContributionsCents,
        row.spendingCents,
        row.shortfallCents,
      ]),
    ).toEqual([
      [50, 50, 50],
      [100, 100, 0],
    ])
  })

  it('routes scheduled requests before gap funding and deposits only unused spendable funds', () => {
    const value = input({
      incomes: [income({ monthlyAmountCents: 300 })],
      monthlySpendingCents: 1_200,
      withdrawalOrder: ['cash', 'ira'],
    })
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [
      account('cash', 1_000, { monthlyContributionCents: 200 }),
      account('ira', 2_000, { monthlyWithdrawalCents: 700 }),
    ]
    const result = project(value)
    expect(result.totals).toMatchObject({
      openingBalanceCents: 3_000,
      externalContributionsCents: 200,
      incomeCents: 300,
      spendingCents: 1_200,
      scheduledWithdrawalsCents: 700,
      automaticWithdrawalsCents: 200,
      surplusDepositsCents: 0,
      closingBalanceCents: 2_300,
    })
    expect(result.accounts.map((a) => a.closingBalanceCents)).toEqual([
      1_000, 1_300,
    ])
    reconcileHousehold(result.totals)
  })

  it('keeps contributions external without subtracting them from income or double counting them', () => {
    const value = input({ incomes: [income()], monthlySpendingCents: 800 })
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [
      account('cash', 0, { monthlyContributionCents: 700 }),
    ]
    expect(project(value).totals).toMatchObject({
      externalContributionsCents: 700,
      incomeCents: 1_000,
      spendingCents: 800,
      surplusDepositsCents: 200,
      automaticWithdrawalsCents: 0,
      closingBalanceCents: 900,
    })
  })

  it('moves surplus scheduled withdrawals to cash without treating transfers as income or extra spending', () => {
    const value = input({ incomes: [income()], monthlySpendingCents: 200 })
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [
      account('cash', 100),
      account('ira', 1_000, { monthlyWithdrawalCents: 500 }),
    ]
    const result = project(value)
    expect(result.totals).toMatchObject({
      incomeCents: 1_000,
      requestedSpendingCents: 200,
      spendingCents: 200,
      scheduledWithdrawalsCents: 500,
      automaticWithdrawalsCents: 0,
      surplusDepositsCents: 1_300,
      closingBalanceCents: 1_900,
    })
    expect(result.accounts.map((a) => a.closingBalanceCents)).toEqual([
      1_400, 500,
    ])
    reconcileHousehold(result.totals)
  })

  it('returns surplus to the sole aggregate account at end month', () => {
    const value = input({
      withdrawalOrder: [],
      incomes: [income()],
      monthlySpendingCents: 200,
    })
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [
      {
        ...account('cash', 1_000, { monthlyWithdrawalCents: 1_000 }),
        kind: 'aggregate',
      },
    ]
    const result = project(value)
    expect(result.totals.closingBalanceCents).toBe(1_800)
    expect(result.totals.surplusDepositsCents).toBe(1_800)
    expect(at(result.accounts, 0).firstDepletionMonth).toBeNull()
  })

  it('does not grow end-month contributions or surplus until the following month', () => {
    const value = input({ incomes: [income()] })
    value.schedule.horizonMonths = 2
    value.schedule.accounts = [
      account('cash', 0, {
        monthlyContributionCents: 1_000,
        rate: { kind: 'effective', annualRate: 1.01 ** 12 - 1 },
      }),
    ]
    expect(
      project(value).monthly.map((row) => [
        row.growthCents,
        row.closingBalanceCents,
      ]),
    ).toEqual([
      [0, 2_000],
      [20, 4_020],
    ])
  })

  it('reports scheduled shortfall independently of household spending and does not carry arrears', () => {
    const value = input({
      incomes: [income()],
      monthlySpendingCents: 800,
      withdrawalOrder: [],
    })
    value.schedule.horizonMonths = 2
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 300, { monthlyWithdrawalCents: 500 }),
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) => [
        row.scheduledWithdrawalsCents,
        row.scheduledWithdrawalShortfallCents,
        row.shortfallCents,
      ]),
    ).toEqual([
      [300, 200, 0],
      [0, 500, 0],
    ])
    expect(result.firstShortfallMonth).toBeNull()
    expect(result.totals.requestedSpendingCents).toBe(1_600)
    expect(result.accounts.map((a) => a.firstDepletionMonth)).toEqual([null, 1])
  })

  it('caps automatic routing in the selected order, depletes, reports gaps, and refills without arrears', () => {
    const value = input({
      monthlySpendingCents: 800,
      withdrawalOrder: ['ira', 'cash'],
    })
    value.schedule.horizonMonths = 4
    value.schedule.accounts = [account('cash', 500), account('ira', 600)]
    value.schedule.phases = [
      phase('now', 0),
      {
        ...phase('refill', 2),
        changes: [{ accountId: 'cash', monthlyContributionCents: 900 }],
      },
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) =>
        row.accounts.map((a) => a.automaticWithdrawalsCents),
      ),
    ).toEqual([
      [200, 600],
      [300, 0],
      [800, 0],
      [800, 0],
    ])
    expect(result.monthly.map((row) => row.shortfallCents)).toEqual([
      0, 500, 0, 0,
    ])
    expect(result.monthly.map((row) => row.closingBalanceCents)).toEqual([
      300, 0, 100, 200,
    ])
    expect(result.accounts.map((a) => a.firstDepletionMonth)).toEqual([2, 1])
    expect(result.firstShortfallMonth).toBe(2)
  })

  it('counts an initially empty account if it ends empty, not if it refills by month end', () => {
    const value = input()
    value.schedule.horizonMonths = 13
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 0, { monthlyContributionCents: 1 }),
    ]
    const result = project(value)
    expect(result.accounts.map((a) => a.firstDepletionMonth)).toEqual([1, null])
    expect(
      at(result.annual, 1).accounts.map((a) => a.firstDepletionMonth),
    ).toEqual([13, null])
  })

  it.each([1, 2, 4, 12, 365] as const)(
    'uses monthly equivalent nominal APR with %i periods per year',
    (periodsPerYear) => {
      const value = input()
      value.schedule.horizonMonths = 2
      value.schedule.accounts = [
        account('cash', 100_000_000, {
          rate: { kind: 'nominal', annualRate: 0.12, periodsPerYear },
        }),
      ]
      const equivalent =
        (1 + 0.12 / periodsPerYear) ** (periodsPerYear / 12) - 1
      const firstGrowth = Math.round(100_000_000 * equivalent)
      const secondGrowth = Math.round((100_000_000 + firstGrowth) * equivalent)
      expect(project(value).monthly.map((row) => row.growthCents)).toEqual([
        firstGrowth,
        secondGrowth,
      ])
    },
  )

  it('matches the existing effective growth engine for shared end-month investment conventions', () => {
    const value = input()
    value.schedule.horizonMonths = 25
    value.annualInflationRate = 0.03
    value.schedule.accounts = [
      account('cash', 100_000, {
        rate: { kind: 'effective', annualRate: 0.06 },
        annualFeeRate: 0.01,
        monthlyContributionCents: 1_000,
      }),
    ]
    const growth = runGrowthProjection({
      startingBalanceCents: 100_000,
      monthlyContributionCents: 1_000,
      monthlyWithdrawalCents: 0,
      months: 25,
      annualReturnRate: 0.06,
      annualInflationRate: 0.03,
      annualFundExpenseRatio: 0,
      annualAdvisoryFeeRate: 0.01,
      returnBasis: 'after-fund-expenses',
      cashFlowTiming: 'end',
    })
    if (!growth.ok) throw new Error('Expected growth success')
    const result = project(value)
    for (const [index, row] of result.monthly.entries()) {
      const comparison = at(growth.projection.monthly, index)
      for (const field of [
        'growthCents',
        'realGrowthCents',
        'closingBalanceCents',
        'realClosingBalanceCents',
      ] as const)
        expect(row[field]).toBe(comparison[field])
      expect(row.feesCents).toBe(comparison.advisoryFeesCents)
    }
  })

  it('applies growth then post-growth annual/12 fees, then flows', () => {
    const value = input({ incomes: [income()], monthlySpendingCents: 1_000 })
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [
      account('cash', 10_000, {
        rate: { kind: 'effective', annualRate: 1.1 ** 12 - 1 },
        annualFeeRate: 0.12,
        monthlyContributionCents: 1_000,
      }),
    ]
    expect(project(value).totals).toMatchObject({
      growthCents: 1_000,
      feesCents: 110,
      closingBalanceCents: 11_890,
    })
  })

  it('rounds negative half-cent growth and positive half-cent fees away from zero', () => {
    const value = input()
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [
      account('cash', 1, {
        rate: { kind: 'effective', annualRate: 0.5 ** 12 - 1 },
      }),
      account('ira', 100, { annualFeeRate: 0.06 }),
    ]
    const result = project(value)
    expect(
      result.accounts.map((a) => [
        a.growthCents,
        a.feesCents,
        a.closingBalanceCents,
      ]),
    ).toEqual([
      [-1, 0, 0],
      [0, 1, 99],
    ])
    expect(
      Object.values(result.totals).some((amount) => Object.is(amount, -0)),
    ).toBe(false)
  })

  it('handles -100% effective returns before contributions and withdrawals with no negative balances', () => {
    const value = input({ monthlySpendingCents: 50 })
    value.schedule.horizonMonths = 2
    value.schedule.accounts = [
      account('cash', 1_000, {
        rate: { kind: 'effective', annualRate: -1 },
        annualFeeRate: 1,
        monthlyContributionCents: 100,
      }),
    ]
    expect(
      project(value).monthly.map((row) => [
        row.growthCents,
        row.feesCents,
        row.closingBalanceCents,
      ]),
    ).toEqual([
      [-1_000, 0, 50],
      [-50, 0, 50],
    ])
  })

  it('discounts globally through phase boundaries, without escalating nominal spending or resetting real growth', () => {
    const value = input({
      annualInflationRate: 0.12,
      monthlySpendingCents: 100,
    })
    value.schedule.accounts = [
      account('cash', 100_000, {
        rate: { kind: 'effective', annualRate: 0.06 },
      }),
    ]
    const baseline = project(value)
    value.schedule.phases = [phase('now', 0), phase('boundary', 12)]
    const result = project(value)
    expect(result.totals).toEqual(baseline.totals)
    for (const row of result.monthly) {
      const discount = Math.exp((Math.log1p(0.12) * row.month) / 12)
      expect(row.realClosingBalanceCents).toBe(
        Math.round(row.closingBalanceCents / discount),
      )
      expect(row.realGrowthCents).toBe(Math.round(row.growthCents / discount))
      expect(row.requestedSpendingCents).toBe(100)
    }
    value.annualInflationRate = -0.2
    const deflation = at(project(value).monthly, 11)
    expect(deflation.realClosingBalanceCents).toBe(
      Math.round(deflation.closingBalanceCents / 0.8),
    )
  })

  it('sums rounded account real cents so household and account reports reconcile exactly', () => {
    const value = input({ annualInflationRate: 2 ** 12 - 1 })
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [account('cash', 1), account('ira', 1)]
    const result = project(value)
    expect(result.totals.realClosingBalanceCents).toBe(2)
    expect(result.accounts.map((a) => a.realClosingBalanceCents)).toEqual([
      1, 1,
    ])
  })

  it('reconciles every account, household, month, year and total for a mixed phased scenario', () => {
    const value = input({
      transfers: [
        transfer({ kind: 'roth-conversion', monthlyAmountCents: 200 }),
        transfer({
          id: 'return',
          sourceAccountId: 'roth',
          destinationAccountId: 'ira',
          monthlyAmountCents: 50,
        }),
        transfer({
          id: 'retirement',
          phaseId: 'retire',
          destinationAccountId: 'cash',
          monthlyAmountCents: 400,
        }),
        transfer({
          id: 'late',
          phaseId: 'rest',
          sourceAccountId: 'cash',
          monthlyAmountCents: 500,
        }),
      ],
      incomes: [
        income({ startAgeMonths: 725, annualIncreaseRate: 0.04 }),
        income({
          id: 'pension',
          label: 'Partner pension',
          person: 'partner',
          kind: 'pension',
          startAgeMonths: 698,
          monthlyAmountCents: 700,
        }),
      ],
      monthlySpendingCents: 3_000,
      withdrawalOrder: ['ira', 'cash'],
      annualInflationRate: 0.04,
      phaseChanges: [
        { phaseId: 'retire', monthlySpendingCents: 4_000 },
        { phaseId: 'rest', monthlySpendingCents: 500 },
      ],
    })
    value.schedule.horizonMonths = 29
    value.schedule.accounts = [
      account('cash', 3_000, {
        monthlyContributionCents: 50,
        rate: { kind: 'nominal', annualRate: 0.03, periodsPerYear: 4 },
      }),
      account('ira', 30_000, {
        monthlyContributionCents: 200,
        monthlyWithdrawalCents: 1_000,
        rate: { kind: 'effective', annualRate: -0.1 },
        annualFeeRate: 0.01,
      }),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    value.schedule.phases = [
      phase('now', 0),
      {
        ...phase('retire', 10),
        changes: [{ accountId: 'ira', monthlyContributionCents: 0 }],
      },
      phase('rest', 20),
    ]
    const result = project(value)
    for (const row of [...result.monthly, ...result.annual]) {
      reconcileHousehold(row)
      for (const a of row.accounts) reconcileAccount(a)
      for (const field of accountFields)
        expect(row[field]).toBe(
          row.accounts.reduce((sum, a) => sum + a[field], 0),
        )
    }
    reconcileHousehold(result.totals)
    for (const a of result.accounts) reconcileAccount(a)
    for (const field of accountFields)
      expect(result.totals[field]).toBe(
        result.accounts.reduce((sum, a) => sum + a[field], 0),
      )
    for (const field of flows) {
      expect(result.totals[field]).toBe(
        result.monthly.reduce((sum, row) => sum + row[field], 0),
      )
      expect(result.totals[field]).toBe(
        result.annual.reduce((sum, row) => sum + row[field], 0),
      )
    }
    expect(result.totals.openingBalanceCents).toBe(33_000)
    expect(result.totals.closingBalanceCents).toBe(
      at(result.monthly, 28).closingBalanceCents,
    )
    for (const [index, row] of result.monthly.entries()) {
      expect(
        row.transfers.reduce((sum, item) => sum + item.amountCents, 0),
      ).toBe(row.transfersOutCents)
      expect(
        row.transfers.reduce((sum, item) => sum + item.shortfallCents, 0),
      ).toBe(row.transferShortfallCents)
      for (const item of row.transfers)
        expect(item.requestedCents).toBe(item.amountCents + item.shortfallCents)
      if (index > 0)
        expect(row.openingBalanceCents).toBe(
          at(result.monthly, index - 1).closingBalanceCents,
        )
      expect(row.accounts.every((a) => a.closingBalanceCents >= 0)).toBe(true)
    }
    for (const year of result.annual) {
      const months = result.monthly.slice(year.startMonth - 1, year.endMonth)
      expect(year.openingBalanceCents).toBe(at(months, 0).openingBalanceCents)
      expect(year.closingBalanceCents).toBe(
        at(months, months.length - 1).closingBalanceCents,
      )
      for (const field of flows)
        expect(year[field]).toBe(
          months.reduce((sum, row) => sum + row[field], 0),
        )
      for (const [index, summary] of year.accounts.entries())
        for (const field of accountFlows)
          expect(summary[field]).toBe(
            months.reduce(
              (sum, row) => sum + at(row.accounts, index)[field],
              0,
            ),
          )
    }
    for (const [index, summary] of result.accounts.entries())
      for (const field of accountFlows)
        expect(summary[field]).toBe(
          result.annual.reduce(
            (sum, row) => sum + at(row.accounts, index)[field],
            0,
          ),
        )
  })

  it('is deterministic, accepts deeply frozen inputs, and returns independent snapshots', () => {
    const value = input({
      incomes: [income()],
      phaseChanges: [{ phaseId: 'now', monthlySpendingCents: 200 }],
    })
    const snapshot = structuredClone(value)
    freezeDeep(value)
    const first = project(value)
    expect(project(value)).toEqual(first)
    expect(value).toEqual(snapshot)
    at(first.monthly, 0).accounts[0] = {
      ...at(at(first.monthly, 0).accounts, 0),
      closingBalanceCents: 999,
    }
    at(at(first.schedule.phases, 0).accounts, 0).settings.rate.annualRate = 9
    expect(project(value).schedule).not.toEqual(first.schedule)
    expect(value).toEqual(snapshot)
  })
})

describe('phase-scoped monthly account transfers', () => {
  it('preserves omitted-transfer behavior, explicit empty transfers and all zero fields', () => {
    const value = input({ incomes: [income()], monthlySpendingCents: 800 })
    value.schedule.accounts = [
      account('cash', 1_000, { monthlyContributionCents: 100 }),
      account('ira', 2_000, { monthlyWithdrawalCents: 200 }),
    ]
    const baseline = project(value)
    expect(project({ ...value, transfers: [] })).toEqual(baseline)
    expect(baseline.monthly.every((row) => row.transfers.length === 0)).toBe(
      true,
    )
    for (const row of [
      baseline.totals,
      ...baseline.accounts,
      ...baseline.monthly,
      ...baseline.annual,
      ...baseline.monthly.flatMap((month) => month.accounts),
      ...baseline.annual.flatMap((year) => year.accounts),
    ])
      expect(row).toMatchObject({
        transfersInCents: 0,
        transfersOutCents: 0,
        transferShortfallCents: 0,
        rothConversionsInCents: 0,
        rothConversionsOutCents: 0,
      })
    const zero = project({
      ...value,
      transfers: [
        transfer({ destinationAccountId: 'cash', monthlyAmountCents: 0 }),
      ],
    })
    expect({
      ...zero,
      monthly: zero.monthly.map((row) => ({ ...row, transfers: [] })),
    }).toEqual(baseline)
    expect(zero.monthly.every((row) => row.transfers.length === 1)).toBe(true)
  })

  it('returns every configured entry in input order with exact zero rows outside its phase', () => {
    const configured = [
      transfer({ id: 'later', phaseId: 'selected', monthlyAmountCents: 200 }),
      transfer({ id: 'earlier', monthlyAmountCents: 100 }),
      transfer({ id: 'zero', phaseId: 'selected', monthlyAmountCents: 0 }),
    ]
    const value = transferInput(configured)
    value.schedule.horizonMonths = 4
    value.schedule.phases = [
      phase('now', 0),
      phase('selected', 1),
      phase('after', 3),
    ]
    const result = project(value)
    const expected: PlanTransferRow[][] = [
      [
        {
          transferId: 'later',
          requestedCents: 0,
          amountCents: 0,
          shortfallCents: 0,
        },
        {
          transferId: 'earlier',
          requestedCents: 100,
          amountCents: 100,
          shortfallCents: 0,
        },
        {
          transferId: 'zero',
          requestedCents: 0,
          amountCents: 0,
          shortfallCents: 0,
        },
      ],
      ...Array.from({ length: 2 }, () => [
        {
          transferId: 'later',
          requestedCents: 200,
          amountCents: 200,
          shortfallCents: 0,
        },
        {
          transferId: 'earlier',
          requestedCents: 0,
          amountCents: 0,
          shortfallCents: 0,
        },
        {
          transferId: 'zero',
          requestedCents: 0,
          amountCents: 0,
          shortfallCents: 0,
        },
      ]),
      configured.map((item) => ({
        transferId: item.id,
        requestedCents: 0,
        amountCents: 0,
        shortfallCents: 0,
      })),
    ]
    expect(result.monthly.map((row) => row.transfers)).toEqual(expected)
    expect(result.monthly.map((row) => row.transfersOutCents)).toEqual([
      100, 200, 200, 0,
    ])
    expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
      0, 500, 500,
    ])
  })

  it('uses input order for competing transfers and conversions, not kind or ID order', () => {
    const conversion = transfer({
      id: 'z-convert',
      kind: 'roth-conversion',
      monthlyAmountCents: 700,
    })
    const ordinary = transfer({
      id: 'a-move',
      destinationAccountId: 'cash',
      monthlyAmountCents: 700,
    })
    for (const configured of [
      [conversion, ordinary],
      [ordinary, conversion],
    ]) {
      const result = project(transferInput(configured))
      expect(at(result.monthly, 0).transfers).toEqual([
        {
          transferId: at(configured, 0).id,
          requestedCents: 700,
          amountCents: 700,
          shortfallCents: 0,
        },
        {
          transferId: at(configured, 1).id,
          requestedCents: 700,
          amountCents: 300,
          shortfallCents: 400,
        },
      ])
      expect(result.totals).toMatchObject({
        transfersInCents: 1_000,
        transfersOutCents: 1_000,
        transferShortfallCents: 400,
        rothConversionsInCents: configured[0] === conversion ? 700 : 300,
        rothConversionsOutCents: configured[0] === conversion ? 700 : 300,
        incomeCents: 0,
        externalContributionsCents: 0,
        closingBalanceCents: 1_000,
      })
      expect(result.accounts.map((row) => row.transferShortfallCents)).toEqual([
        0, 400, 0,
      ])
      reconcileHousehold(result.totals)
      for (const row of result.accounts) reconcileAccount(row)
    }
  })

  it('makes earlier receipts available to later entries, including cycles, but never revisits earlier shortages', () => {
    const configured = [
      transfer({
        id: 'early',
        sourceAccountId: 'roth',
        destinationAccountId: 'cash',
        monthlyAmountCents: 500,
      }),
      transfer({
        id: 'convert',
        kind: 'roth-conversion',
        monthlyAmountCents: 700,
      }),
      transfer({
        id: 'return',
        sourceAccountId: 'roth',
        destinationAccountId: 'ira',
        monthlyAmountCents: 300,
      }),
      transfer({
        id: 'last',
        destinationAccountId: 'cash',
        monthlyAmountCents: 600,
      }),
    ]
    const result = project(transferInput(configured))
    expect(
      at(result.monthly, 0).transfers.map((row) => [
        row.amountCents,
        row.shortfallCents,
      ]),
    ).toEqual([
      [0, 500],
      [700, 0],
      [300, 0],
      [600, 0],
    ])
    expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
      600, 0, 400,
    ])
    expect(result.totals.transfersOutCents).toBe(1_600)
    expect(result.firstShortfallMonth).toBeNull()
    reconcileHousehold(result.totals)
  })

  it('runs after all contributions and scheduled-to-spending withdrawals but before automatic gap funding', () => {
    const value = transferInput([
      transfer({
        sourceAccountId: 'cash',
        destinationAccountId: 'ira',
        monthlyAmountCents: 200,
      }),
    ])
    value.incomes = [income({ monthlyAmountCents: 500 })]
    value.monthlySpendingCents = 800
    value.withdrawalOrder = ['ira']
    value.schedule.accounts = [
      account('cash', 100, {
        monthlyContributionCents: 200,
        monthlyWithdrawalCents: 150,
      }),
      account('ira', 0, { monthlyWithdrawalCents: 100 }),
    ]
    const result = project(value)
    expect(result.totals).toMatchObject({
      externalContributionsCents: 200,
      scheduledWithdrawalsCents: 150,
      scheduledWithdrawalShortfallCents: 100,
      transfersInCents: 150,
      transfersOutCents: 150,
      transferShortfallCents: 50,
      automaticWithdrawalsCents: 150,
      incomeCents: 500,
      spendingCents: 800,
      shortfallCents: 0,
      closingBalanceCents: 0,
    })
    reconcileHousehold(result.totals)
    for (const row of result.accounts) reconcileAccount(row)
  })

  it('cannot transfer this month income or unused scheduled funds deposited as surplus later', () => {
    const value = transferInput([
      transfer({ sourceAccountId: 'cash', monthlyAmountCents: 200 }),
    ])
    value.incomes = [income({ monthlyAmountCents: 100 })]
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 100, { monthlyWithdrawalCents: 100 }),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = project(value)
    expect(result.totals).toMatchObject({
      transfersOutCents: 0,
      transferShortfallCents: 200,
      surplusDepositsCents: 200,
    })
    expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
      200, 0, 0,
    ])
  })

  it('reports partial and empty-source requests with no carryforward after refill', () => {
    const value = transferInput([
      transfer({ sourceAccountId: 'cash', monthlyAmountCents: 500 }),
    ])
    value.schedule.horizonMonths = 3
    value.schedule.accounts = [
      account('cash', 100, { monthlyContributionCents: 200 }),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    value.incomes = [income({ startAgeMonths: 721, monthlyAmountCents: 1_000 })]
    const result = project(value)
    expect(result.monthly.map((row) => row.transfers)).toEqual([
      [
        {
          transferId: 'move',
          requestedCents: 500,
          amountCents: 300,
          shortfallCents: 200,
        },
      ],
      [
        {
          transferId: 'move',
          requestedCents: 500,
          amountCents: 200,
          shortfallCents: 300,
        },
      ],
      [
        {
          transferId: 'move',
          requestedCents: 500,
          amountCents: 500,
          shortfallCents: 0,
        },
      ],
    ])
    expect(result.totals.transferShortfallCents).toBe(500)
    expect(result.firstShortfallMonth).toBeNull()
  })

  it('does not treat transfer shortfall as spending shortfall or make conversions spendable automatically', () => {
    const value = transferInput([
      transfer({ kind: 'roth-conversion', monthlyAmountCents: 1_200 }),
    ])
    value.monthlySpendingCents = 100
    value.withdrawalOrder = ['ira']
    const result = project(value)
    expect(result.totals).toMatchObject({
      transfersOutCents: 1_000,
      transferShortfallCents: 200,
      rothConversionsOutCents: 1_000,
      incomeCents: 0,
      spendingCents: 0,
      shortfallCents: 100,
      closingBalanceCents: 1_000,
    })
    expect(result.firstShortfallMonth).toBe(1)
  })

  it('starts destination growth and fees the following month at its own rate', () => {
    const value = transferInput([
      transfer({ kind: 'roth-conversion', monthlyAmountCents: 1_000 }),
    ])
    value.schedule.horizonMonths = 2
    value.schedule.phases = [phase('now', 0), phase('after', 1)]
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 1_000),
      {
        ...account('roth', 0, {
          rate: { kind: 'effective', annualRate: 1.1 ** 12 - 1 },
          annualFeeRate: 0.12,
        }),
        kind: 'roth-ira',
      },
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) => [
        row.growthCents,
        row.feesCents,
        row.closingBalanceCents,
      ]),
    ).toEqual([
      [0, 0, 1_000],
      [100, 11, 1_089],
    ])
    expect(
      at(result.monthly, 1).accounts.map((row) => row.openingBalanceCents),
    ).toEqual([0, 0, 1_000])
  })

  it.each(
    (['primary', 'partner'] as const).flatMap((owner) =>
      (['traditional-401k', 'traditional-ira'] as const).flatMap((sourceKind) =>
        (['roth-401k', 'roth-ira'] as const).map((destinationKind) => ({
          owner,
          sourceKind,
          destinationKind,
        })),
      ),
    ),
  )(
    'converts $sourceKind to $destinationKind for $owner without tax or eligibility deductions',
    ({ owner, sourceKind, destinationKind }) => {
      const value = transferInput([
        transfer({ kind: 'roth-conversion', monthlyAmountCents: 1_000 }),
      ])
      value.schedule.accounts = [
        account('cash', 0),
        { ...account('ira', 1_000), kind: sourceKind, owner },
        { ...account('roth', 0), kind: destinationKind, owner },
      ]
      const result = project(value)
      expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
        0, 0, 1_000,
      ])
      expect(result.totals).toMatchObject({
        transfersInCents: 1_000,
        transfersOutCents: 1_000,
        rothConversionsInCents: 1_000,
        rothConversionsOutCents: 1_000,
        feesCents: 0,
        incomeCents: 0,
        externalContributionsCents: 0,
      })
      reconcileHousehold(result.totals)
    },
  )

  it('allows ordinary transfers across account kinds and owners without tagging conversions', () => {
    const value = transferInput([
      transfer({ sourceAccountId: 'cash', monthlyAmountCents: 100 }),
      transfer({
        id: 'back',
        sourceAccountId: 'roth',
        destinationAccountId: 'ira',
        monthlyAmountCents: 100,
      }),
    ])
    value.schedule.accounts = [
      { ...account('cash', 100), owner: 'joint' },
      { ...account('ira', 0), owner: 'partner' },
      { ...account('roth', 0), kind: 'roth-401k' },
    ]
    const result = project(value)
    expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
      0, 100, 0,
    ])
    expect(result.totals).toMatchObject({
      transfersInCents: 200,
      transfersOutCents: 200,
      rothConversionsInCents: 0,
      rothConversionsOutCents: 0,
    })
  })

  it('sums transfer and conversion flows across full and partial years', () => {
    const value = transferInput([transfer({ kind: 'roth-conversion' })])
    value.schedule.horizonMonths = 14
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 1_250),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = project(value)
    expect(
      result.annual.map((row) => [
        row.transfersInCents,
        row.transfersOutCents,
        row.transferShortfallCents,
        row.rothConversionsInCents,
        row.rothConversionsOutCents,
      ]),
    ).toEqual([
      [1_200, 1_200, 0, 1_200, 1_200],
      [50, 50, 150, 50, 50],
    ])
    expect(result.totals).toMatchObject({
      transfersInCents: 1_250,
      transfersOutCents: 1_250,
      transferShortfallCents: 150,
      rothConversionsInCents: 1_250,
      rothConversionsOutCents: 1_250,
      openingBalanceCents: 1_250,
      closingBalanceCents: 1_250,
    })
    expect(at(at(result.annual, 1).accounts, 1)).toMatchObject({
      transfersOutCents: 50,
      rothConversionsOutCents: 50,
      transferShortfallCents: 150,
      firstDepletionMonth: 13,
    })
    expect(at(at(result.annual, 1).accounts, 2)).toMatchObject({
      transfersInCents: 50,
      rothConversionsInCents: 50,
      transferShortfallCents: 0,
    })
  })

  it('accepts frozen transfers without mutation and returns independent transfer snapshots', () => {
    const value = transferInput()
    value.schedule.horizonMonths = 2
    const snapshot = structuredClone(value)
    freezeDeep(value)
    const first = project(value)
    expect(project(value)).toEqual(first)
    at(at(first.monthly, 0).transfers, 0).amountCents = 999
    expect(at(at(first.monthly, 1).transfers, 0).amountCents).toBe(100)
    expect(at(at(project(value).monthly, 0).transfers, 0).amountCents).toBe(100)
    expect(value).toEqual(snapshot)
  })
})

describe('transfer phase ranges', () => {
  function rangeInput(
    transfers: readonly AccountTransfer[],
  ): PlanProjectionInput {
    const value = transferInput(transfers)
    value.schedule.horizonMonths = 8
    value.schedule.phases = [
      phase('now', 0),
      phase('start', 2),
      phase('end', 4),
      phase('final', 6),
    ]
    return value
  }

  it('starts at the selected phase and includes every month of the ending phase only', () => {
    const value = rangeInput([
      transfer({ phaseId: 'start', endPhaseId: 'end' }),
    ])
    const result = project(value)
    expect(result.monthly.map((row) => at(row.transfers, 0))).toEqual(
      [0, 0, 100, 100, 100, 100, 0, 0].map((amount) => ({
        transferId: 'move',
        requestedCents: amount,
        amountCents: amount,
        shortfallCents: 0,
      })),
    )
    expect(result.totals.transfersOutCents).toBe(400)
    expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
      0, 600, 400,
    ])
    reconcileHousehold(result.totals)
    for (const row of result.accounts) reconcileAccount(row)
  })

  it.each(['now', 'start', 'end', 'final'])(
    'keeps legacy single-phase behavior identical to an explicit same-phase end in %s',
    (phaseId) => {
      const legacy = project(rangeInput([transfer({ phaseId })]))
      const explicit = project(
        rangeInput([transfer({ phaseId, endPhaseId: phaseId })]),
      )
      expect(explicit).toEqual(legacy)
      expect(legacy.monthly.map((row) => row.transfersOutCents)).toEqual(
        legacy.monthly.map((row) => (row.phaseId === phaseId ? 100 : 0)),
      )
      expect(legacy.totals.transfersOutCents).toBe(200)
    },
  )

  it.each(['start', 'final'])(
    'treats a named final phase and null equally from %s through the exact horizon',
    (phaseId) => {
      const value = rangeInput([transfer({ phaseId, endPhaseId: null })])
      value.schedule.horizonMonths = 9
      const indefinite = project(value)
      value.transfers = [transfer({ phaseId, endPhaseId: 'final' })]
      expect(project(value)).toEqual(indefinite)
      expect(indefinite.monthly).toHaveLength(9)
      const startOffset = phaseId === 'start' ? 2 : 6
      expect(indefinite.monthly.map((row) => row.transfersOutCents)).toEqual(
        Array.from({ length: 9 }, (_, index) =>
          index < startOffset ? 0 : 100,
        ),
      )
    },
  )

  it('preserves input priority across overlapping ranges and source shortages without carryforward', () => {
    const value = rangeInput([
      transfer({
        id: 'first',
        phaseId: 'start',
        endPhaseId: 'end',
        monthlyAmountCents: 80,
      }),
      transfer({
        id: 'second',
        endPhaseId: null,
        destinationAccountId: 'cash',
        monthlyAmountCents: 100,
      }),
    ])
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 0, { monthlyContributionCents: 100 }),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) =>
        row.transfers.map((item) => [item.amountCents, item.shortfallCents]),
      ),
    ).toEqual([
      [
        [0, 0],
        [100, 0],
      ],
      [
        [0, 0],
        [100, 0],
      ],
      [
        [80, 0],
        [20, 80],
      ],
      [
        [80, 0],
        [20, 80],
      ],
      [
        [80, 0],
        [20, 80],
      ],
      [
        [80, 0],
        [20, 80],
      ],
      [
        [0, 0],
        [100, 0],
      ],
      [
        [0, 0],
        [100, 0],
      ],
    ])
    expect(result.totals).toMatchObject({
      transfersOutCents: 800,
      transferShortfallCents: 320,
      externalContributionsCents: 800,
      incomeCents: 0,
    })
    expect(result.firstShortfallMonth).toBeNull()
    for (const row of result.monthly) reconcileHousehold(row)
  })

  it('freezes percentage references across phases and recalculates in January inside an inclusive range', () => {
    const value = percentageInput([
      percentageTransfer({
        phaseId: 'start',
        endPhaseId: 'end',
        annualRate: 0.12,
        kind: 'roth-conversion',
      }),
    ])
    value.schedule.startMonth = '2026-07'
    value.schedule.horizonMonths = 12
    value.schedule.accounts = [
      account('cash', 0),
      { ...account('ira', 12_000_000), priorYearEndBalanceCents: 10_000_000 },
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    value.schedule.phases = [
      phase('now', 0),
      phase('start', 2),
      phase('december', 5),
      phase('end', 8),
      phase('after', 10),
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) => at(row.transfers, 0).requestedCents),
    ).toEqual([
      0, 0, 100_000, 100_000, 100_000, 100_000, 116_000, 116_000, 116_000,
      116_000, 0, 0,
    ])
    for (const [index, row] of result.monthly.entries()) {
      const item = at(row.transfers, 0)
      if (index >= 2 && index < 10)
        expect(item).toMatchObject({
          referenceBalanceCents: index < 6 ? 10_000_000 : 11_600_000,
          annualRequestedCents: index < 6 ? 1_200_000 : 1_392_000,
        })
      else
        expect(item).toEqual({
          transferId: 'percentage',
          requestedCents: 0,
          amountCents: 0,
          shortfallCents: 0,
        })
      reconcileHousehold(row)
    }
    expect(result.totals).toMatchObject({
      transfersOutCents: 864_000,
      rothConversionsOutCents: 864_000,
      closingBalanceCents: 12_000_000,
    })
  })

  it.each([null, 'final'] as const)(
    'requires first-year reference from the range start, not its end %s',
    (endPhaseId) => {
      const value = percentageInput([
        percentageTransfer({ phaseId: 'start', endPhaseId }),
      ])
      value.schedule.startMonth = '2026-12'
      value.schedule.horizonMonths = 4
      value.schedule.phases = [
        phase('now', 0),
        phase('start', 1),
        phase('final', 3),
      ]
      value.schedule.accounts = [
        account('cash', 0),
        account('ira', 12_000),
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      const result = project(value)
      expect(result.monthly.map((row) => row.transfersOutCents)).toEqual([
        0, 100, 100, 100,
      ])
      for (const row of result.monthly.slice(1))
        expect(at(row.transfers, 0).referenceBalanceCents).toBe(12_000)
      value.transfers = [percentageTransfer({ endPhaseId })]
      rejected(value, 'accounts.1.priorYearEndBalanceCents')
      value.schedule.accounts = value.schedule.accounts.map((account) =>
        account.id === 'ira'
          ? { ...account, priorYearEndBalanceCents: 0 }
          : account,
      )
      expect(
        project(value).monthly.map((row) => row.transfersOutCents),
      ).toEqual([0, 100, 100, 100])
    },
  )

  it.each(['', ' ', ' end', 'end ', undefined, 1, {}, []])(
    'rejects invalid supplied ending phase %s',
    (endPhaseId) => {
      rejected(
        {
          ...rangeInput([]),
          transfers: [{ ...transfer(), endPhaseId }],
        },
        'transfers.0.endPhaseId',
      )
    },
  )

  it('rejects missing and reversed endpoints, including zero amount transfers', () => {
    rejected(
      rangeInput([transfer({ phaseId: 'missing', endPhaseId: 'end' })]),
      'transfers.0.phaseId',
    )
    rejected(
      rangeInput([transfer({ phaseId: 'start', endPhaseId: 'missing' })]),
      'transfers.0.endPhaseId',
    )
    rejected(
      rangeInput([
        transfer({
          phaseId: 'end',
          endPhaseId: 'start',
          monthlyAmountCents: 0,
        }),
      ]),
      'transfers.0.endPhaseId',
    )
    rejected(
      rangeInput([
        percentageTransfer({
          phaseId: 'final',
          endPhaseId: 'now',
          annualRate: 0,
        }),
      ]),
      'transfers.0.endPhaseId',
    )
  })

  it('accepts frozen ranged inputs and returns independent snapshots without changing the compiled schedule', () => {
    const value = rangeInput([
      transfer({ phaseId: 'start', endPhaseId: 'end' }),
      transfer({ id: 'forever', phaseId: 'final', endPhaseId: null }),
    ])
    const snapshot = structuredClone(value)
    freezeDeep(value)
    const result = project(value)
    expect(project(value)).toEqual(result)
    expect(value).toEqual(snapshot)
    const compiled = compilePlan(value.schedule)
    if (!compiled.ok) throw new Error('Expected valid schedule')
    expect(result.schedule).toEqual(compiled.plan)
    at(at(result.monthly, 2).transfers, 0).amountCents = 999
    expect(at(at(result.monthly, 3).transfers, 0).amountCents).toBe(100)
    expect(at(at(project(value).monthly, 2).transfers, 0).amountCents).toBe(100)
  })

  it('retains requested-total overflow protection across a range boundary', () => {
    const value = rangeInput([
      transfer({
        endPhaseId: null,
        monthlyAmountCents: Math.ceil(Number.MAX_SAFE_INTEGER / 2),
      }),
    ])
    value.schedule.horizonMonths = 2
    value.schedule.phases = [phase('now', 0), phase('next', 1)]
    rejected(value, 'calculation')
  })
})

describe('calendar-year percentage transfers', () => {
  it('uses the explicit prior-year balance, not starting balance, for a full January-December year', () => {
    const value = percentageInput([
      percentageTransfer({ kind: 'roth-conversion' }),
    ])
    const snapshot = structuredClone(value)
    freezeDeep(value)
    const result = project(value)
    expect(value).toEqual(snapshot)
    expect(project(value)).toEqual(result)
    expect(result.monthly.map((row) => at(row.transfers, 0))).toEqual(
      Array.from({ length: 12 }, () => ({
        transferId: 'percentage',
        requestedCents: 100,
        amountCents: 100,
        shortfallCents: 0,
        referenceBalanceCents: 12_000,
        annualRequestedCents: 1_200,
      })),
    )
    expect(result.accounts.map((row) => row.closingBalanceCents)).toEqual([
      0, 18_800, 1_200,
    ])
    expect(result.totals).toMatchObject({
      transfersInCents: 1_200,
      transfersOutCents: 1_200,
      rothConversionsInCents: 1_200,
      rothConversionsOutCents: 1_200,
      incomeCents: 0,
      externalContributionsCents: 0,
    })
    for (const row of [...result.monthly, ...result.annual]) {
      reconcileHousehold(row)
      for (const account of row.accounts) reconcileAccount(account)
    }
    reconcileHousehold(result.totals)
    for (const field of flows)
      expect(result.totals[field]).toBe(
        result.monthly.reduce((sum, row) => sum + row[field], 0),
      )
    at(at(result.monthly, 0).transfers, 0).referenceBalanceCents = 99
    expect(at(at(result.monthly, 1).transfers, 0).referenceBalanceCents).toBe(
      12_000,
    )
  })

  it.each([
    [0, 0],
    [120, 12],
    [12_000, 1_200],
  ])(
    'accepts explicitly provided first-year reference %i cents and annual target %i',
    (reference, annual) => {
      const value = percentageInput()
      value.schedule.accounts = [
        account('cash', 0),
        { ...account('ira', 20_000), priorYearEndBalanceCents: reference },
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      const result = project(value)
      expect(result.totals.transfersOutCents).toBe(annual)
      expect(at(at(result.monthly, 0).transfers, 0)).toMatchObject({
        referenceBalanceCents: reference,
        annualRequestedCents: annual,
      })
    },
  )

  it('starts in December with only its installment, then rolls over from actual December closings', () => {
    const value = percentageInput()
    value.schedule.startMonth = '2024-12'
    value.schedule.horizonMonths = 14
    const result = project(value)
    expect(at(at(result.monthly, 0).transfers, 0)).toMatchObject({
      referenceBalanceCents: 12_000,
      annualRequestedCents: 1_200,
      requestedCents: 100,
    })
    for (const row of result.monthly.slice(1, 13))
      expect(at(row.transfers, 0)).toMatchObject({
        referenceBalanceCents: 19_900,
        annualRequestedCents: 1_990,
      })
    expect(
      result.monthly
        .slice(1, 13)
        .reduce((sum, row) => sum + at(row.transfers, 0).requestedCents, 0),
    ).toBe(1_990)
    expect(at(at(result.monthly, 13).transfers, 0)).toMatchObject({
      referenceBalanceCents: 17_910,
      annualRequestedCents: 1_791,
      requestedCents: 149,
    })
    expect(result.annual.map((row) => [row.startMonth, row.endMonth])).toEqual([
      [1, 12],
      [13, 14],
    ])
    for (const year of result.annual)
      expect(year.transfersOutCents).toBe(
        result.monthly
          .slice(year.startMonth - 1, year.endMonth)
          .reduce((sum, row) => sum + row.transfersOutCents, 0),
      )
  })

  it.each([
    ['2025-01', 0, 0],
    ['2025-06', 1, 1],
    ['2025-07', 0, 0],
    ['2025-12', 0, 0],
  ])(
    'uses calendar fractions rather than projection month numbering from %s',
    (startMonth, firstRequest, total) => {
      const value = percentageInput([percentageTransfer({ annualRate: 1 })])
      value.schedule.startMonth = startMonth
      value.schedule.horizonMonths = 1
      value.schedule.accounts = [
        account('cash', 0),
        { ...account('ira', 1_000), priorYearEndBalanceCents: 1 },
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      const result = project(value)
      expect(at(at(result.monthly, 0).transfers, 0).requestedCents).toBe(
        firstRequest,
      )
      expect(result.totals.transfersOutCents).toBe(total)
    },
  )

  it('uses only active calendar installments in partial phases, with no catchup or inheritance', () => {
    const value = percentageInput([
      percentageTransfer({ id: 'middle', phaseId: 'middle', annualRate: 1 }),
      percentageTransfer({
        id: 'december',
        phaseId: 'december',
        annualRate: 1,
      }),
    ])
    value.schedule.accounts = [
      account('cash', 0),
      { ...account('ira', 1_000), priorYearEndBalanceCents: 7 },
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    value.schedule.phases = [
      phase('now', 0),
      phase('middle', 6),
      phase('gap', 9),
      phase('december', 11),
    ]
    const result = project(value)
    expect(result.monthly.map((row) => row.transfersOutCents)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1,
    ])
    expect(result.totals.transfersOutCents).toBe(2)
    for (const row of result.monthly)
      for (const item of row.transfers) {
        const active = row.phaseId === item.transferId
        if (active)
          expect(item).toMatchObject({
            referenceBalanceCents: 7,
            annualRequestedCents: 7,
          })
        else
          expect(item).toEqual({
            transferId: item.transferId,
            requestedCents: 0,
            amountCents: 0,
            shortfallCents: 0,
          })
      }
  })

  it('captures December even when percentage transfers first start midyear in a later phase', () => {
    const value = percentageInput([
      percentageTransfer({ phaseId: 'later', annualRate: 0.12 }),
    ])
    value.schedule.startMonth = '2024-12'
    value.schedule.horizonMonths = 13
    value.schedule.phases = [phase('now', 0), phase('later', 7)]
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 10_000, { monthlyContributionCents: 100 }),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = project(value)
    expect(at(at(result.monthly, 6).accounts, 1).closingBalanceCents).toBe(
      10_700,
    )
    for (const row of result.monthly.slice(7))
      expect(at(row.transfers, 0)).toMatchObject({
        referenceBalanceCents: 10_100,
        annualRequestedCents: 1_212,
        requestedCents: 101,
      })
    expect(result.totals.transfersOutCents).toBe(606)
  })

  it.each([
    [2_600, 10_090, 500, 1_211, 60],
    [1_000, 10_390, 1_800, 1_247, 216],
  ])(
    'uses actual December post-flow balances after spending %i, including growth, fees, contributions, transfers and gap/surplus',
    (spending, iraClosing, cashClosing, iraAnnual, cashAnnual) => {
      const value = percentageInput([
        transfer({
          sourceAccountId: 'cash',
          destinationAccountId: 'ira',
          monthlyAmountCents: 500,
        }),
        percentageTransfer({ phaseId: 'next', annualRate: 0.12 }),
        percentageTransfer({
          id: 'cash-percent',
          phaseId: 'next',
          sourceAccountId: 'cash',
          annualRate: 0.12,
        }),
      ])
      value.schedule.startMonth = '2024-12'
      value.schedule.horizonMonths = 3
      value.schedule.accounts = [
        { ...account('cash', 1_000), priorYearEndBalanceCents: 888 },
        {
          ...account('ira', 10_000, {
            rate: { kind: 'effective', annualRate: 1.1 ** 12 - 1 },
            annualFeeRate: 0.12,
            monthlyContributionCents: 1_000,
            monthlyWithdrawalCents: 2_000,
          }),
          priorYearEndBalanceCents: 999,
        },
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      value.schedule.phases = [
        phase('now', 0),
        {
          ...phase('next', 1),
          changes: [
            {
              accountId: 'ira',
              monthlyContributionCents: 0,
              monthlyWithdrawalCents: 0,
              annualFeeRate: 0,
              rate: { kind: 'effective', annualRate: 0 },
            },
          ],
        },
      ]
      value.incomes = [income({ monthlyAmountCents: 300 })]
      value.monthlySpendingCents = spending
      value.withdrawalOrder = ['ira']
      value.phaseChanges = [{ phaseId: 'next', monthlySpendingCents: 0 }]
      const result = project(value)
      expect(
        at(result.monthly, 0).accounts.map((row) => row.closingBalanceCents),
      ).toEqual([cashClosing, iraClosing, 0])
      for (const row of result.monthly.slice(1)) {
        expect(at(row.transfers, 1)).toMatchObject({
          referenceBalanceCents: iraClosing,
          annualRequestedCents: iraAnnual,
        })
        expect(at(row.transfers, 2)).toMatchObject({
          referenceBalanceCents: cashClosing,
          annualRequestedCents: cashAnnual,
        })
      }
      for (const row of result.monthly) reconcileHousehold(row)
      reconcileHousehold(result.totals)
    },
  )

  it('freezes separate source references across sequential percentage transfers and conversions, with no shortfall carryforward', () => {
    const value = percentageInput([
      percentageTransfer({ kind: 'roth-conversion' }),
      percentageTransfer({ id: 'second', destinationAccountId: 'cash' }),
      percentageTransfer({
        id: 'third',
        sourceAccountId: 'cash',
        destinationAccountId: 'ira',
        annualRate: 0.12,
      }),
    ])
    value.schedule.horizonMonths = 2
    value.schedule.accounts = [
      { ...account('cash', 0), priorYearEndBalanceCents: 10_000 },
      { ...account('ira', 150), priorYearEndBalanceCents: 12_000 },
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = project(value)
    expect(
      result.monthly.map((row) =>
        row.transfers.map((item) => [
          item.requestedCents,
          item.amountCents,
          item.shortfallCents,
        ]),
      ),
    ).toEqual([
      [
        [100, 100, 0],
        [100, 50, 50],
        [100, 50, 50],
      ],
      [
        [100, 50, 50],
        [100, 0, 100],
        [100, 0, 100],
      ],
    ])
    for (const row of result.monthly) {
      expect(row.transfers.map((item) => item.referenceBalanceCents)).toEqual([
        12_000, 12_000, 10_000,
      ])
      expect(row.transfers.map((item) => item.annualRequestedCents)).toEqual([
        1_200, 1_200, 1_200,
      ])
      reconcileHousehold(row)
      for (const account of row.accounts) reconcileAccount(account)
    }
    expect(result.totals.rothConversionsOutCents).toBe(150)
    expect(result.firstShortfallMonth).toBeNull()
  })

  it.each([
    0,
    ...Array.from({ length: 24 }, (_, index) => index + 1),
    101,
    Number.MAX_SAFE_INTEGER,
  ])(
    'reconciles exact cumulative calendar rounding for annual target %i without negative December remainders',
    (annual) => {
      const value = percentageInput([percentageTransfer({ annualRate: 1 })])
      value.schedule.accounts = [
        account('cash', 0),
        { ...account('ira', 0), priorYearEndBalanceCents: annual },
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      const result = project(value)
      let cumulative = 0n
      for (const [index, row] of result.monthly.entries()) {
        const request = at(row.transfers, 0).requestedCents
        expect(Number.isSafeInteger(request)).toBe(true)
        expect(request).toBeGreaterThanOrEqual(0)
        cumulative += BigInt(request)
        const roundingError =
          cumulative * 12n - BigInt(annual) * BigInt(index + 1)
        expect(roundingError).toBeGreaterThan(-6n)
        expect(roundingError).toBeLessThanOrEqual(6n)
      }
      expect(cumulative).toBe(BigInt(annual))
      expect(result.totals.transferShortfallCents).toBe(annual)
    },
  )

  it.each([
    [5, 0.1, 1],
    [15, 0.1, 2],
    [25, 0.1, 3],
    [1, 0.49, 0],
  ])(
    'rounds the annual target before installments: %i at %s gives %i cents',
    (reference, annualRate, target) => {
      const value = percentageInput([percentageTransfer({ annualRate })])
      value.schedule.accounts = [
        account('cash', 0),
        { ...account('ira', 1_000), priorYearEndBalanceCents: reference },
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      const result = project(value)
      expect(result.totals.transfersOutCents).toBe(target)
      expect(
        result.monthly.every(
          (row) => at(row.transfers, 0).annualRequestedCents === target,
        ),
      ).toBe(true)
    },
  )

  it('preserves legacy and explicitly tagged fixed-dollar output shapes without percentage audit fields', () => {
    const legacy = project(transferInput())
    const explicit = project(
      transferInput([transfer({ amountKind: 'monthly-dollars' })]),
    )
    expect(explicit).toEqual(legacy)
    expect(at(at(legacy.monthly, 0).transfers, 0)).toEqual({
      transferId: 'move',
      requestedCents: 100,
      amountCents: 100,
      shortfallCents: 0,
    })
    const withReference = transferInput()
    withReference.schedule.accounts = withReference.schedule.accounts.map(
      (item) => ({ ...item, priorYearEndBalanceCents: 999 }),
    )
    expect(project(withReference)).toEqual(legacy)
    const result = compilePlan(withReference.schedule)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected valid schedule')
    expect(result.plan).toEqual(legacy.schedule)
  })
})

describe('percentage transfer validation and overflow', () => {
  it.each([
    ['2025-01', 11, true],
    ['2025-01', 12, false],
    ['2025-07', 5, true],
    ['2025-07', 6, false],
    ['2025-12', 0, true],
    ['2025-12', 1, false],
  ] as const)(
    'requires an explicit seed only for first-year sources: %s + %i months',
    (startMonth, startOffset, needsSeed) => {
      const value = percentageInput([
        percentageTransfer({
          phaseId: startOffset === 0 ? 'now' : 'selected',
          annualRate: 0,
        }),
      ])
      value.schedule.startMonth = startMonth
      value.schedule.horizonMonths = startOffset + 1
      value.schedule.accounts = [
        account('cash', 0),
        account('ira', 20_000),
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      if (startOffset > 0)
        value.schedule.phases = [
          phase('now', 0),
          phase('selected', startOffset),
        ]
      if (needsSeed) rejected(value, 'accounts.1.priorYearEndBalanceCents')
      else expect(project(value).totals.transfersOutCents).toBe(0)
    },
  )

  it('reports missing first-year references once per source in account-index order', () => {
    const value = percentageInput([
      percentageTransfer(),
      percentageTransfer({ id: 'duplicate-source' }),
      percentageTransfer({ id: 'cash-source', sourceAccountId: 'cash' }),
    ])
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 0),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = runPlanProjection(value)
    if (result.ok) throw new Error('Expected missing reference errors')
    expect(result.errors.map((error) => error.path)).toEqual([
      'accounts.0.priorYearEndBalanceCents',
      'accounts.1.priorYearEndBalanceCents',
    ])
  })

  it.each([
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    NaN,
    null,
    undefined,
    '100',
  ])(
    'rejects invalid prior-year balance %s even without percentage transfers',
    (priorYearEndBalanceCents) => {
      const value = transferInput()
      const schedule = {
        ...value.schedule,
        accounts: value.schedule.accounts.map((item) => ({
          ...item,
          priorYearEndBalanceCents,
        })),
      }
      rejected({ ...value, schedule }, 'accounts.0.priorYearEndBalanceCents')
      const compiled = compilePlan(schedule)
      if (compiled.ok) throw new Error('Expected invalid account reference')
      expect(compiled.errors).toContainEqual({
        path: 'accounts.0.priorYearEndBalanceCents',
        message: expect.any(String),
      })
    },
  )

  it.each([-0.01, Infinity, NaN, null, undefined, '0.1'])(
    'rejects invalid annual percentage rate %s',
    (annualRate) => {
      rejected(
        {
          ...percentageInput(),
          transfers: [{ ...percentageTransfer(), annualRate }],
        },
        'transfers.0.annualRate',
      )
    },
  )

  it.each(['monthly-percentage', null, undefined, 1])(
    'rejects invalid amountKind %s',
    (amountKind) => {
      rejected(
        {
          ...percentageInput(),
          transfers: [{ ...percentageTransfer(), amountKind }],
        },
        'transfers.0.amountKind',
      )
    },
  )

  it('rejects mixed or missing amount-mode fields', () => {
    rejected(
      {
        ...percentageInput(),
        transfers: [{ ...percentageTransfer(), monthlyAmountCents: 0 }],
      },
      'transfers.0.monthlyAmountCents',
    )
    rejected(
      {
        ...percentageInput(),
        transfers: [
          { ...transfer(), amountKind: 'monthly-dollars', annualRate: 0 },
        ],
      },
      'transfers.0.annualRate',
    )
    rejected(
      {
        ...percentageInput(),
        transfers: [{ ...transfer(), annualRate: 0 }],
      },
      'transfers.0.annualRate',
    )
    const missing: Record<string, unknown> = { ...percentageTransfer() }
    delete missing.annualRate
    rejected(
      { ...percentageInput(), transfers: [missing] },
      'transfers.0.annualRate',
    )
  })

  it('keeps conversion kind and ownership validation for percentage amounts', () => {
    const value = percentageInput([
      percentageTransfer({ kind: 'roth-conversion', sourceAccountId: 'cash' }),
    ])
    rejected(value, 'transfers.0.sourceAccountId')
    value.transfers = [percentageTransfer({ kind: 'roth-conversion' })]
    value.schedule.accounts = value.schedule.accounts.map((item) =>
      item.id === 'roth' ? { ...item, owner: 'partner' } : item,
    )
    rejected(value, 'transfers.0.destinationAccountId')
    value.transfers = [percentageTransfer()]
    expect(project(value).totals.transfersOutCents).toBe(1_200)
  })

  it('accepts rates above 100 percent and any finite rate against a zero reference', () => {
    const value = percentageInput([percentageTransfer({ annualRate: 2 })])
    const result = project(value)
    expect(at(at(result.monthly, 0).transfers, 0).annualRequestedCents).toBe(
      24_000,
    )
    expect(result.totals.transfersOutCents).toBe(20_000)
    expect(result.totals.transferShortfallCents).toBe(4_000)
    value.transfers = [percentageTransfer({ annualRate: Number.MAX_VALUE })]
    value.schedule.accounts = value.schedule.accounts.map((item) => ({
      ...item,
      priorYearEndBalanceCents: 0,
    }))
    expect(project(value).totals.transfersOutCents).toBe(0)
  })

  it.each([2, Number.MAX_VALUE])(
    'rejects annual target overflow at rate %s even in a one-month phase',
    (annualRate) => {
      const value = percentageInput([percentageTransfer({ annualRate })])
      value.schedule.horizonMonths = 1
      value.schedule.accounts = value.schedule.accounts.map((item) => ({
        ...item,
        priorYearEndBalanceCents: Number.MAX_SAFE_INTEGER,
      }))
      rejected(value, 'calculation')
    },
  )

  it('preserves aggregate requested-overflow protection for percentage transfers', () => {
    const value = percentageInput([
      percentageTransfer({ annualRate: 1 }),
      percentageTransfer({ id: 'second', annualRate: 1 }),
    ])
    value.schedule.accounts = [
      account('cash', 0),
      {
        ...account('ira', Number.MAX_SAFE_INTEGER),
        priorYearEndBalanceCents: Number.MAX_SAFE_INTEGER,
      },
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    rejected(value, 'calculation')
  })
})

describe('transfer validation and overflow', () => {
  it.each([null, undefined, {}, 'transfers', 1])(
    'rejects a present nonarray transfers value: %s',
    (transfers) => {
      rejected({ ...input(), transfers }, 'transfers')
    },
  )

  it.each([null, undefined, [], new Date(), 1, 'transfer'])(
    'rejects nonobject transfer entries: %s',
    (item) => {
      rejected({ ...input(), transfers: [item] }, 'transfers.0')
    },
  )

  it.each([
    ['id', ''],
    ['id', ' padded'],
    ['id', ' '],
    ['id', null],
    ['phaseId', ''],
    ['phaseId', 'missing'],
    ['kind', 'conversion'],
    ['kind', undefined],
    ['sourceAccountId', ''],
    ['sourceAccountId', 'missing'],
    ['destinationAccountId', ''],
    ['destinationAccountId', 'missing'],
    ['monthlyAmountCents', -1],
    ['monthlyAmountCents', 0.5],
    ['monthlyAmountCents', Number.MAX_SAFE_INTEGER + 1],
    ['monthlyAmountCents', NaN],
    ['monthlyAmountCents', Infinity],
    ['monthlyAmountCents', '100'],
    ['monthlyAmountCents', null],
  ])(
    'rejects invalid transfer %s = %s with transfer-index paths',
    (field, value) => {
      rejected(
        {
          ...transferInput(),
          transfers: [{ ...transfer(), [String(field)]: value }],
        },
        `transfers.0.${String(field)}`,
      )
    },
  )

  it('requires every transfer field and rejects unknown fields including symbols', () => {
    for (const key of Object.keys(transfer())) {
      const missing: Record<string, unknown> = { ...transfer() }
      delete missing[key]
      rejected(
        { ...transferInput(), transfers: [missing] },
        `transfers.0.${key}`,
      )
    }
    rejected(
      {
        ...transferInput(),
        transfers: [{ ...transfer(), taxRate: 0.2 }],
      },
      'transfers.0.taxRate',
    )
    rejected(
      {
        ...transferInput(),
        transfers: [{ ...transfer(), [Symbol('extra')]: true }],
      },
      'transfers.0.Symbol(extra)',
    )
    rejected({ ...transferInput(), transfers: Array(1) }, 'transfers.0')
  })

  it('requires globally unique transfer IDs even across phases, and distinct endpoints even for zero requests', () => {
    const value = transferInput([
      transfer(),
      transfer({ phaseId: 'later', monthlyAmountCents: 0 }),
    ])
    value.schedule.horizonMonths = 2
    value.schedule.phases = [phase('now', 0), phase('later', 1)]
    rejected(value, 'transfers.1.id')
    rejected(
      transferInput([
        transfer({ destinationAccountId: 'ira', monthlyAmountCents: 0 }),
      ]),
      'transfers.0.destinationAccountId',
    )
  })

  it.each(['savings', 'taxable', 'roth-401k', 'roth-ira'] as const)(
    'rejects Roth conversion source kind %s',
    (kind) => {
      const value = transferInput([transfer({ kind: 'roth-conversion' })])
      value.schedule.accounts = [
        account('cash', 0),
        { ...account('ira', 100), kind },
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      rejected(value, 'transfers.0.sourceAccountId')
    },
  )

  it.each([
    'savings',
    'taxable',
    'traditional-401k',
    'traditional-ira',
  ] as const)('rejects Roth conversion destination kind %s', (kind) => {
    const value = transferInput([transfer({ kind: 'roth-conversion' })])
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', 100),
      { ...account('roth', 0), kind },
    ]
    rejected(value, 'transfers.0.destinationAccountId')
  })

  it.each([
    ['primary', 'partner'],
    ['partner', 'primary'],
    ['joint', 'primary'],
    ['primary', 'joint'],
    ['joint', 'joint'],
  ] as const)(
    'rejects conversions from %s to %s ownership',
    (sourceOwner, destinationOwner) => {
      const value = transferInput([transfer({ kind: 'roth-conversion' })])
      value.schedule.accounts = [
        account('cash', 0),
        {
          ...account('ira', 100),
          owner: sourceOwner,
          kind: sourceOwner === 'joint' ? 'taxable' : 'traditional-ira',
        },
        {
          ...account('roth', 0),
          owner: destinationOwner,
          kind: destinationOwner === 'joint' ? 'taxable' : 'roth-ira',
        },
      ]
      const result = runPlanProjection(value)
      if (result.ok) throw new Error('Expected rejection')
      expect(result.errors).toContainEqual({
        path: 'transfers.0.destinationAccountId',
        message: 'Roth conversions require the same individual owner.',
      })
    },
  )

  it.each([
    [
      'destination balance',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', 0),
          account('ira', 1),
          { ...account('roth', Number.MAX_SAFE_INTEGER), kind: 'roth-ira' },
        ]
      },
    ],
    [
      'account cumulative outgoing and incoming',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', Number.MAX_SAFE_INTEGER),
          account('ira', 0),
        ]
        value.transfers = [
          transfer({
            sourceAccountId: 'cash',
            destinationAccountId: 'ira',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
          transfer({
            id: 'back',
            destinationAccountId: 'cash',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
          transfer({
            id: 'again',
            sourceAccountId: 'cash',
            destinationAccountId: 'ira',
            monthlyAmountCents: 1,
          }),
        ]
      },
    ],
    [
      'household monthly transferred flows',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', Number.MAX_SAFE_INTEGER),
          account('ira', 0),
        ]
        value.transfers = [
          transfer({
            sourceAccountId: 'cash',
            destinationAccountId: 'ira',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
          transfer({
            id: 'back',
            destinationAccountId: 'cash',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
        ]
      },
    ],
    [
      'source monthly shortfalls',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [account('cash', 0), account('ira', 0)]
        value.transfers = [
          transfer({
            destinationAccountId: 'cash',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
          transfer({
            id: 'again',
            destinationAccountId: 'cash',
            monthlyAmountCents: 1,
          }),
        ]
      },
    ],
    [
      'household monthly shortfalls',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [account('cash', 0), account('ira', 0)]
        value.transfers = [
          transfer({
            destinationAccountId: 'cash',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
          transfer({
            id: 'other-source',
            sourceAccountId: 'cash',
            destinationAccountId: 'ira',
            monthlyAmountCents: 1,
          }),
        ]
      },
    ],
    [
      'annual transferred flows',
      (value: PlanProjectionInput) => {
        const amount = Math.floor(Number.MAX_SAFE_INTEGER / 2)
        value.schedule.horizonMonths = 2
        value.schedule.accounts = [account('cash', amount), account('ira', 0)]
        value.transfers = [
          transfer({
            sourceAccountId: 'cash',
            destinationAccountId: 'ira',
            monthlyAmountCents: amount,
          }),
          transfer({
            id: 'back',
            destinationAccountId: 'cash',
            monthlyAmountCents: amount,
          }),
        ]
      },
    ],
    [
      'annual shortfalls',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 2
        value.schedule.accounts = [account('cash', 0), account('ira', 0)]
        value.transfers = [
          transfer({
            destinationAccountId: 'cash',
            monthlyAmountCents: Number.MAX_SAFE_INTEGER,
          }),
        ]
      },
    ],
    [
      'whole-horizon transferred flows',
      (value: PlanProjectionInput) => {
        const amount = Math.floor(Number.MAX_SAFE_INTEGER / 24)
        value.schedule.horizonMonths = 13
        value.schedule.accounts = [
          account('cash', 0),
          account('ira', amount),
          { ...account('roth', 0), kind: 'roth-ira' },
        ]
        value.transfers = [
          transfer({ kind: 'roth-conversion', monthlyAmountCents: amount }),
          transfer({
            id: 'back',
            sourceAccountId: 'roth',
            destinationAccountId: 'ira',
            monthlyAmountCents: amount,
          }),
        ]
      },
    ],
    [
      'whole-horizon shortfalls',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 13
        value.schedule.accounts = [account('cash', 0), account('ira', 0)]
        value.transfers = [
          transfer({
            destinationAccountId: 'cash',
            monthlyAmountCents: Math.floor(Number.MAX_SAFE_INTEGER / 12),
          }),
        ]
      },
    ],
  ] as const)(
    'rejects overflow in %s without partial projection results',
    (_name, configure) => {
      const value = transferInput()
      configure(value)
      rejected(value, 'calculation')
    },
  )

  it.each([
    ['across entries in one month', 1, false],
    ['for one entry across months', 2, false],
    ['across distinct phases', 2, true],
    ['for one phase spanning projection years', 14, true],
  ] as const)(
    'rejects requested-total overflow %s even when moved and shortfall totals are safe',
    (_name, horizonMonths, splitPhases) => {
      const amount =
        horizonMonths === 14
          ? Math.floor(Number.MAX_SAFE_INTEGER / 12)
          : Math.ceil(Number.MAX_SAFE_INTEGER / 2)
      const sourceBalance = horizonMonths === 14 ? amount * 2 : 1_000
      const value = transferInput()
      value.schedule.horizonMonths = horizonMonths
      value.schedule.accounts = [
        account('cash', 0),
        account('ira', sourceBalance),
        { ...account('roth', 0), kind: 'roth-ira' },
      ]
      if (splitPhases)
        value.schedule.phases = [phase('now', 0), phase('later', 1)]
      value.transfers =
        horizonMonths === 1 || (horizonMonths === 2 && splitPhases)
          ? [
              transfer({ monthlyAmountCents: amount }),
              transfer({
                id: 'second',
                phaseId: splitPhases ? 'later' : 'now',
                monthlyAmountCents: amount,
              }),
            ]
          : [
              transfer({
                phaseId: splitPhases ? 'later' : 'now',
                kind: 'roth-conversion',
                monthlyAmountCents: amount,
              }),
            ]
      const requested = BigInt(amount) * BigInt(horizonMonths === 14 ? 13 : 2)
      expect(requested).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER))
      expect(BigInt(sourceBalance)).toBeLessThanOrEqual(
        BigInt(Number.MAX_SAFE_INTEGER),
      )
      expect(requested - BigInt(sourceBalance)).toBeLessThanOrEqual(
        BigInt(Number.MAX_SAFE_INTEGER),
      )
      rejected(value, 'calculation')
    },
  )

  it('accepts a maximum-safe requested aggregate with mixed funding and counts only active months', () => {
    const value = transferInput([
      transfer({
        kind: 'roth-conversion',
        monthlyAmountCents: Number.MAX_SAFE_INTEGER,
      }),
    ])
    value.schedule.horizonMonths = 24
    value.schedule.phases = [phase('now', 0), phase('later', 1)]
    const result = project(value)
    expect(result.totals).toMatchObject({
      transfersOutCents: 1_000,
      transferShortfallCents: Number.MAX_SAFE_INTEGER - 1_000,
    })
    expect(
      result.monthly.reduce(
        (sum, row) => sum + BigInt(at(row.transfers, 0).requestedCents),
        0n,
      ),
    ).toBe(BigInt(Number.MAX_SAFE_INTEGER))
    expect(
      result.monthly
        .slice(1)
        .every((row) => at(row.transfers, 0).requestedCents === 0),
    ).toBe(true)
  })

  it('accepts maximum-safe conversion cents when every intermediate and total is safe', () => {
    const value = transferInput([
      transfer({
        kind: 'roth-conversion',
        monthlyAmountCents: Number.MAX_SAFE_INTEGER,
      }),
    ])
    value.schedule.accounts = [
      account('cash', 0),
      account('ira', Number.MAX_SAFE_INTEGER),
      { ...account('roth', 0), kind: 'roth-ira' },
    ]
    const result = project(value)
    expect(result.totals).toMatchObject({
      transfersInCents: Number.MAX_SAFE_INTEGER,
      transfersOutCents: Number.MAX_SAFE_INTEGER,
      rothConversionsInCents: Number.MAX_SAFE_INTEGER,
      rothConversionsOutCents: Number.MAX_SAFE_INTEGER,
      transferShortfallCents: 0,
      closingBalanceCents: Number.MAX_SAFE_INTEGER,
    })
    reconcileHousehold(result.totals)
  })
})

describe('projection runtime validation and overflow', () => {
  it.each([null, [], 1, 'plan', new Date(), undefined])(
    'rejects nonobjects: %s',
    (value) => {
      rejected(value, 'input')
    },
  )

  it.each([
    ['incomes', null],
    ['incomes', {}],
    ['incomes', [null]],
    ['phaseChanges', null],
    ['phaseChanges', {}],
    ['phaseChanges', [null]],
    ['withdrawalOrder', null],
    ['withdrawalOrder', {}],
    ['cashAccountId', ''],
    ['cashAccountId', ' cash '],
    ['monthlySpendingCents', -1],
    ['monthlySpendingCents', 0.5],
    ['monthlySpendingCents', Number.MAX_SAFE_INTEGER + 1],
    ['monthlySpendingCents', Infinity],
    ['monthlySpendingCents', null],
    ['annualInflationRate', -1],
    ['annualInflationRate', NaN],
    ['annualInflationRate', Infinity],
    ['annualInflationRate', '0'],
  ])('rejects invalid %s = %s', (field, value) => {
    rejected(
      { ...input(), [String(field)]: value },
      Array.isArray(value) ? `${String(field)}.0` : String(field),
    )
  })

  it.each([
    ['id', ''],
    ['id', ' bad'],
    ['label', ''],
    ['label', 'bad '],
    ['kind', 'wages'],
    ['person', 'joint'],
    ['startAgeMonths', -1],
    ['startAgeMonths', 1_801],
    ['startAgeMonths', 1.5],
    ['startAgeMonths', null],
    ['monthlyAmountCents', -1],
    ['monthlyAmountCents', 0.1],
    ['monthlyAmountCents', Infinity],
    ['annualIncreaseRate', -0.01],
    ['annualIncreaseRate', Infinity],
    ['annualIncreaseRate', NaN],
    ['annualIncreaseRate', null],
  ])('rejects invalid income %s = %s', (field, value) => {
    rejected(
      input({ incomes: [{ ...income(), [String(field)]: value }] }),
      `incomes.0.${String(field)}`,
    )
  })

  it('requires unique income IDs and labels and an existing partner', () => {
    rejected(input({ incomes: [income(), income()] }), 'incomes.1.id')
    rejected(
      input({ incomes: [income(), income({ id: 'another' })] }),
      'incomes.1.label',
    )
    const value = input({ incomes: [income({ person: 'partner' })] })
    value.schedule.partnerAgeMonths = null
    rejected(value, 'incomes.0.person')
  })

  it('rejects unknown root, schedule, income and phase-change fields including symbols', () => {
    rejected({ ...input(), extra: true }, 'extra')
    rejected({ ...input(), [Symbol('extra')]: true }, 'Symbol(extra)')
    rejected(
      { ...input(), schedule: { ...input().schedule, extra: true } },
      'extra',
    )
    rejected(
      { ...input(), incomes: [{ ...income(), endAgeMonths: 800 }] },
      'incomes.0.endAgeMonths',
    )
    rejected(
      { ...input(), phaseChanges: [{ phaseId: 'now', extra: 1 }] },
      'phases.0.cashFlow.extra',
    )
    rejected(
      { ...input(), incomes: [{ ...income(), [Symbol('extra')]: 1 }] },
      'incomes.0.Symbol(extra)',
    )
  })

  it('requires all input fields and rejects explicit undefined optional overrides', () => {
    const value = input()
    for (const key of Object.keys(value)) {
      const missing: Record<string, unknown> = { ...value }
      delete missing[key]
      rejected(missing, key === 'schedule' ? 'input' : key)
    }
    rejected(
      {
        ...value,
        phaseChanges: [{ phaseId: 'now', monthlySpendingCents: undefined }],
      },
      'phases.0.cashFlow.monthlySpendingCents',
    )
    rejected(
      {
        ...value,
        phaseChanges: [{ phaseId: 'now', withdrawalOrder: undefined }],
      },
      'phases.0.cashFlow.withdrawalOrder',
    )
  })

  it('preserves schedule compiler errors without a schedule prefix', () => {
    const value = input()
    value.schedule.accounts = [account('cash', -1)]
    rejected(value, 'accounts.0.startingBalanceCents')
    value.schedule.accounts = [account()]
    value.schedule.phases = [phase('now', 0), phase('too-late', 24)]
    rejected(value, 'phases.1.start.ageMonths')
  })

  it('requires an existing savings or sole aggregate cash destination', () => {
    rejected(input({ cashAccountId: 'missing' }), 'cashAccountId')
    const value = input({ cashAccountId: 'ira' })
    value.schedule.accounts = [account(), account('ira')]
    rejected(value, 'cashAccountId')
  })

  it.each([
    [['missing'], 'withdrawalOrder.0'],
    [['cash', 'cash'], 'withdrawalOrder.1'],
    [[null], 'withdrawalOrder.0'],
    [[' cash'], 'withdrawalOrder.0'],
  ])('rejects invalid withdrawal order %s', (order, path) => {
    rejected({ ...input(), withdrawalOrder: order }, path)
  })

  it('maps changes by schedule index, rejects duplicates and checks all phase cash-flow references', () => {
    const value = input()
    value.schedule.phases = [phase('now', 0), phase('next', 1)]
    rejected(
      {
        ...value,
        phaseChanges: [{ phaseId: 'next', monthlySpendingCents: -1 }],
      },
      'phases.1.cashFlow.monthlySpendingCents',
    )
    rejected(
      { ...value, phaseChanges: [{ phaseId: 'now' }, { phaseId: 'now' }] },
      'phases.0.cashFlow.phaseId',
    )
    rejected(
      { ...value, phaseChanges: [{ phaseId: 'missing' }] },
      'phaseChanges.0.phaseId',
    )
    rejected(
      {
        ...value,
        phaseChanges: [{ phaseId: 'next', withdrawalOrder: ['missing'] }],
      },
      'phases.1.cashFlow.withdrawalOrder.0',
    )
    rejected(
      {
        ...value,
        phaseChanges: [{ phaseId: 'next', withdrawalOrder: ['cash', 'cash'] }],
      },
      'phases.1.cashFlow.withdrawalOrder.1',
    )
    rejected(
      { ...value, phaseChanges: [{ phaseId: 'next', withdrawalOrder: null }] },
      'phases.1.cashFlow.withdrawalOrder',
    )
  })

  it('accepts explicitly empty streams, routing, and changes with zero monetary values', () => {
    const value = input({
      incomes: [],
      withdrawalOrder: [],
      phaseChanges: [],
      monthlySpendingCents: 0,
    })
    value.schedule.accounts = [account('cash', 0)]
    expect(project(value).totals.closingBalanceCents).toBe(0)
  })

  it.each([
    [
      'balance growth',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', Number.MAX_SAFE_INTEGER, {
            rate: { kind: 'effective', annualRate: 1 },
          }),
        ]
      },
    ],
    [
      'combined accounts',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', Number.MAX_SAFE_INTEGER),
          account('ira', 1),
        ]
      },
    ],
    [
      'external contribution',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', Number.MAX_SAFE_INTEGER, {
            monthlyContributionCents: 1,
          }),
        ]
      },
    ],
    [
      'surplus deposit',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [account('cash', Number.MAX_SAFE_INTEGER)]
        value.incomes = [income({ monthlyAmountCents: 1 })]
      },
    ],
    [
      'income escalation',
      (value: PlanProjectionInput) => {
        value.incomes = [
          income({ startAgeMonths: 0, annualIncreaseRate: Number.MAX_VALUE }),
        ]
      },
    ],
    [
      'combined income',
      (value: PlanProjectionInput) => {
        value.incomes = [
          income({ monthlyAmountCents: Number.MAX_SAFE_INTEGER }),
          income({ id: 'other', label: 'Other', monthlyAmountCents: 1 }),
        ]
      },
    ],
    [
      'income plus scheduled funds',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', 1, { monthlyWithdrawalCents: 1 }),
        ]
        value.incomes = [
          income({ monthlyAmountCents: Number.MAX_SAFE_INTEGER }),
        ]
        value.monthlySpendingCents = Number.MAX_SAFE_INTEGER
      },
    ],
    [
      'real balance',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [account('cash', Number.MAX_SAFE_INTEGER)]
        value.annualInflationRate = -0.1
      },
    ],
    [
      'real growth',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', Number.MAX_SAFE_INTEGER, {
            rate: { kind: 'effective', annualRate: -1 },
          }),
        ]
        value.annualInflationRate = -0.1
      },
    ],
    [
      'inflation factor',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 24
        value.annualInflationRate = Number.MAX_VALUE
      },
    ],
    [
      'annual spending total',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 2
        value.monthlySpendingCents = Number.MAX_SAFE_INTEGER
      },
    ],
    [
      'annual scheduled shortfall',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 2
        value.schedule.accounts = [
          account('cash', 0, {
            monthlyWithdrawalCents: Number.MAX_SAFE_INTEGER,
          }),
        ]
      },
    ],
    [
      'whole horizon totals',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 13
        value.monthlySpendingCents = Math.floor(Number.MAX_SAFE_INTEGER / 12)
      },
    ],
    [
      'nominal equivalent rate',
      (value: PlanProjectionInput) => {
        value.schedule.accounts = [
          account('cash', 1, {
            rate: {
              kind: 'nominal',
              annualRate: Number.MAX_VALUE,
              periodsPerYear: 365,
            },
          }),
        ]
      },
    ],
    [
      'real flow total',
      (value: PlanProjectionInput) => {
        value.schedule.horizonMonths = 3
        value.annualInflationRate = -0.95
        value.schedule.accounts = [
          account('cash', 4_000_000_000_000_000, {
            rate: { kind: 'effective', annualRate: 0.5 ** 12 - 1 },
            monthlyContributionCents: 2_000_000_000_000_000,
          }),
        ]
      },
    ],
  ] as const)(
    'rejects numeric overflow in %s without partial results',
    (_name, configure) => {
      const value = input()
      value.schedule.horizonMonths = 1
      configure(value)
      rejected(value, 'calculation')
    },
  )

  it('accepts maximum safe cents when no computed value overflows', () => {
    const value = input()
    value.schedule.horizonMonths = 1
    value.schedule.accounts = [account('cash', Number.MAX_SAFE_INTEGER)]
    expect(project(value).totals.closingBalanceCents).toBe(
      Number.MAX_SAFE_INTEGER,
    )
  })
})
