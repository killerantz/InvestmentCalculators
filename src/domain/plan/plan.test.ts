import { describe, expect, it } from 'vitest'
import { compilePlan } from './index'
import type { AccountSettings, CompiledPlan, PlanInput } from './index'

function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) throw new Error(`Expected item at index ${index}`)
  return value
}

function settings(): AccountSettings {
  return {
    monthlyContributionCents: 10_000,
    monthlyWithdrawalCents: 0,
    annualFeeRate: 0.01,
    rate: { kind: 'effective', annualRate: 0.06 },
  }
}

function input(): PlanInput {
  return {
    startMonth: '2024-12',
    horizonMonths: 24,
    primaryAgeMonths: 59 * 12,
    partnerAgeMonths: 57 * 12,
    accounts: [
      {
        id: 'savings',
        label: 'Savings',
        kind: 'savings',
        owner: 'joint',
        startingBalanceCents: 123_456,
        settings: settings(),
      },
    ],
    phases: [
      { id: 'now', label: 'Now', start: { kind: 'plan-start' }, changes: [] },
      {
        id: 'later',
        label: '59 years, 6 months',
        start: { kind: 'age', person: 'primary', ageMonths: 59 * 12 + 6 },
        changes: [{ accountId: 'savings', monthlyContributionCents: 0 }],
      },
      {
        id: 'partner',
        label: 'Partner 58',
        start: { kind: 'age', person: 'partner', ageMonths: 58 * 12 },
        changes: [{ accountId: 'savings', monthlyWithdrawalCents: 1_000 }],
      },
    ],
  }
}

function compiled(value: unknown = input()): CompiledPlan {
  const result = compilePlan(value)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.plan
}

function rejected(value: unknown, path: string) {
  const result = compilePlan(value)
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('Expected validation failure')
  expect(result).not.toHaveProperty('plan')
  expect(result.errors).toEqual(
    expect.arrayContaining([{ path, message: expect.any(String) }]),
  )
  expect(result.errors.every((issue) => issue.message.trim().length > 0)).toBe(
    true,
  )
}

describe('headless plan schedule compiler', () => {
  it('compiles exact end-exclusive intervals, dual ages and setting sources', () => {
    expect(compiled()).toEqual({
      version: 'plan-schedule-1.0.0',
      endMonthExclusive: '2026-12',
      phases: [
        {
          id: 'now',
          label: 'Now',
          startOffsetMonths: 0,
          endOffsetMonths: 6,
          startMonth: '2024-12',
          endMonthExclusive: '2025-06',
          primaryAgeMonths: 708,
          partnerAgeMonths: 684,
          accounts: [
            {
              accountId: 'savings',
              settings: settings(),
              sources: {
                monthlyContributionCents: null,
                monthlyWithdrawalCents: null,
                annualFeeRate: null,
                rate: null,
              },
            },
          ],
        },
        {
          id: 'later',
          label: '59 years, 6 months',
          startOffsetMonths: 6,
          endOffsetMonths: 12,
          startMonth: '2025-06',
          endMonthExclusive: '2025-12',
          primaryAgeMonths: 714,
          partnerAgeMonths: 690,
          accounts: [
            {
              accountId: 'savings',
              settings: { ...settings(), monthlyContributionCents: 0 },
              sources: {
                monthlyContributionCents: 'later',
                monthlyWithdrawalCents: null,
                annualFeeRate: null,
                rate: null,
              },
            },
          ],
        },
        {
          id: 'partner',
          label: 'Partner 58',
          startOffsetMonths: 12,
          endOffsetMonths: 24,
          startMonth: '2025-12',
          endMonthExclusive: '2026-12',
          primaryAgeMonths: 720,
          partnerAgeMonths: 696,
          accounts: [
            {
              accountId: 'savings',
              settings: {
                ...settings(),
                monthlyContributionCents: 0,
                monthlyWithdrawalCents: 1_000,
              },
              sources: {
                monthlyContributionCents: 'later',
                monthlyWithdrawalCents: 'partner',
                annualFeeRate: null,
                rate: null,
              },
            },
          ],
        },
      ],
    })
  })

  it('recomputes anchor offsets when current primary age changes', () => {
    const value = input()
    value.primaryAgeMonths += 3
    expect(
      compiled(value).phases.map((phase) => phase.startOffsetMonths),
    ).toEqual([0, 3, 12])
    expect(
      compiled(value).phases.map((phase) => phase.primaryAgeMonths),
    ).toEqual([711, 714, 723])
  })

  it('supports an absent partner and switching an anchor to primary', () => {
    const value = input()
    value.partnerAgeMonths = null
    value.accounts = [{ ...at(value.accounts, 0), owner: 'primary' }]
    value.phases = [
      at(value.phases, 0),
      {
        ...at(value.phases, 1),
        start: { kind: 'age', person: 'primary', ageMonths: 714 },
      },
    ]
    expect(
      compiled(value).phases.map((phase) => phase.partnerAgeMonths),
    ).toEqual([null, null])
  })

  it.each([
    ['2024-01', 2, '2024-03'],
    ['2024-02', 1, '2024-03'],
    ['2023-02', 12, '2024-02'],
    ['0001-01', 1, '0001-02'],
    ['9999-11', 1, '9999-12'],
    ['2024-12', 1_200, '2124-12'],
  ])(
    'uses calendar month arithmetic from %s for %i months',
    (startMonth, horizonMonths, end) => {
      const value = {
        ...input(),
        startMonth,
        horizonMonths,
        phases: [at(input().phases, 0)],
      }
      expect(compiled(value).endMonthExclusive).toBe(end)
      expect(at(compiled(value).phases, 0).endMonthExclusive).toBe(end)
    },
  )

  it('carries zero overrides forward; omission never resets them; rate replaces the whole object', () => {
    const value = input()
    value.phases = [
      {
        ...at(value.phases, 0),
        changes: [
          {
            accountId: 'savings',
            monthlyWithdrawalCents: 0,
            annualFeeRate: 0,
            rate: { kind: 'nominal', annualRate: 0, periodsPerYear: 12 },
          },
        ],
      },
      {
        ...at(value.phases, 1),
        changes: [
          {
            accountId: 'savings',
            monthlyContributionCents: 0,
            rate: { kind: 'effective', annualRate: -1 },
          },
        ],
      },
      { ...at(value.phases, 2), changes: [{ accountId: 'savings' }] },
    ]
    const phases = compiled(value).phases
    expect(at(at(phases, 2).accounts, 0)).toEqual({
      accountId: 'savings',
      settings: {
        monthlyContributionCents: 0,
        monthlyWithdrawalCents: 0,
        annualFeeRate: 0,
        rate: { kind: 'effective', annualRate: -1 },
      },
      sources: {
        monthlyContributionCents: 'later',
        monthlyWithdrawalCents: 'now',
        annualFeeRate: 'now',
        rate: 'later',
      },
    })
    expect(at(at(phases, 0).accounts, 0).settings.rate).toEqual({
      kind: 'nominal',
      annualRate: 0,
      periodsPerYear: 12,
    })
  })

  it('restores defaults only through explicit values and attributes even equal-value overrides', () => {
    const value = input()
    value.phases = [
      at(value.phases, 0),
      at(value.phases, 1),
      {
        ...at(value.phases, 2),
        changes: [{ accountId: 'savings', ...settings() }],
      },
    ]
    expect(at(at(compiled(value).phases, 2).accounts, 0)).toEqual({
      accountId: 'savings',
      settings: settings(),
      sources: {
        monthlyContributionCents: 'partner',
        monthlyWithdrawalCents: 'partner',
        annualFeeRate: 'partner',
        rate: 'partner',
      },
    })
  })

  it('preserves account order and isolates changes by account, even for prototype-like IDs', () => {
    const value = input()
    value.accounts = [
      { ...at(value.accounts, 0), id: '__proto__' },
      {
        ...at(value.accounts, 0),
        id: 'constructor',
        owner: 'partner',
        kind: 'roth-ira',
      },
    ]
    value.phases = [
      {
        ...at(value.phases, 0),
        changes: [{ accountId: 'constructor', monthlyContributionCents: 0 }],
      },
    ]
    const accounts = at(compiled(value).phases, 0).accounts
    expect(accounts.map((account) => account.accountId)).toEqual([
      '__proto__',
      'constructor',
    ])
    expect(
      accounts.map((account) => account.settings.monthlyContributionCents),
    ).toEqual([10_000, 0])
  })

  it('is deterministic, accepts deeply frozen inputs, and copies all output snapshots', () => {
    const value = input()
    const original = structuredClone(value)
    function freeze(item: unknown) {
      if (typeof item !== 'object' || item === null) return
      Object.values(item).forEach(freeze)
      Object.freeze(item)
    }
    freeze(value)
    const first = compiled(value)
    expect(compiled(value)).toEqual(first)
    expect(value).toEqual(original)
    const firstAccount = at(at(first.phases, 0).accounts, 0)
    firstAccount.settings.rate.annualRate = 99
    firstAccount.settings.monthlyContributionCents = 99
    firstAccount.sources.rate = 'changed'
    expect(at(at(first.phases, 1).accounts, 0).settings.rate.annualRate).toBe(
      0.06,
    )
    expect(at(at(first.phases, 1).accounts, 0).sources.rate).toBe(null)
    expect(value).toEqual(original)
    expect(at(at(compiled(value).phases, 0).accounts, 0).settings).toEqual(
      settings(),
    )
  })

  it('allows all supported account kinds and nominal compounding periods', () => {
    for (const kind of [
      'aggregate',
      'savings',
      'taxable',
      'traditional-401k',
      'roth-401k',
      'traditional-ira',
      'roth-ira',
    ] as const) {
      for (const periodsPerYear of [1, 2, 4, 12, 365] as const) {
        const value = input()
        value.accounts = [
          {
            ...at(value.accounts, 0),
            kind,
            owner: 'primary',
            startingBalanceCents: Number.MAX_SAFE_INTEGER,
            settings: {
              ...settings(),
              monthlyContributionCents: Number.MAX_SAFE_INTEGER,
              monthlyWithdrawalCents: Number.MAX_SAFE_INTEGER,
              annualFeeRate: 1,
              rate: {
                kind: 'nominal',
                annualRate: Number.MAX_VALUE,
                periodsPerYear,
              },
            },
          },
        ]
        expect(compilePlan(value).ok).toBe(true)
      }
    }
  })

  it('does not impose arbitrary account or phase limits', () => {
    const value = input()
    value.horizonMonths = 1_200
    value.accounts = Array.from({ length: 150 }, (_, i) => ({
      ...at(value.accounts, 0),
      id: `account-${i}`,
    }))
    value.phases = Array.from({ length: 1_200 }, (_, i) => ({
      id: `phase-${i}`,
      label: `Phase ${i}`,
      changes: [],
      start:
        i === 0
          ? { kind: 'plan-start' }
          : {
              kind: 'age',
              person: 'primary',
              ageMonths: value.primaryAgeMonths + i,
            },
    }))
    expect(compiled(value).phases).toHaveLength(1_200)
  })
})

describe('runtime validation', () => {
  it.each([undefined, null, [], 'plan', 123, true])(
    'rejects non-object input %s',
    (value) => {
      rejected(value, 'input')
    },
  )

  it.each([
    ['startMonth', undefined],
    ['startMonth', 202401],
    ['startMonth', '2024-1'],
    ['startMonth', '0000-01'],
    ['startMonth', '10000-01'],
    ['startMonth', '2024-00'],
    ['startMonth', '2024-13'],
    ['startMonth', '2024-01\n'],
    ['startMonth', ' 2024-01'],
    ['horizonMonths', 0],
    ['horizonMonths', -1],
    ['horizonMonths', 1_201],
    ['horizonMonths', 1.5],
    ['horizonMonths', Infinity],
    ['horizonMonths', NaN],
    ['horizonMonths', '12'],
    ['primaryAgeMonths', -1],
    ['primaryAgeMonths', 1801],
    ['primaryAgeMonths', 1.5],
    ['primaryAgeMonths', null],
    ['primaryAgeMonths', NaN],
    ['partnerAgeMonths', undefined],
    ['partnerAgeMonths', -1],
    ['partnerAgeMonths', 1801],
    ['partnerAgeMonths', 1.5],
    ['partnerAgeMonths', '600'],
    ['accounts', []],
    ['accounts', null],
    ['accounts', {}],
    ['phases', []],
    ['phases', null],
    ['phases', {}],
  ])('rejects invalid %s: %s', (key, value) =>
    rejected({ ...input(), [key]: value }, key),
  )

  it('describes starting age limits as supported inputs, not predicted longevity', () => {
    const result = compilePlan({ ...input(), primaryAgeMonths: 1801 })
    if (result.ok) throw new Error('Expected error')
    expect(
      result.errors.find((issue) => issue.path === 'primaryAgeMonths')?.message,
    ).toMatch(/supported input range/i)
  })

  it('allows supported initial age endpoints without limiting later ages', () => {
    const value = input()
    value.primaryAgeMonths = 1800
    value.partnerAgeMonths = 0
    value.phases = [
      at(value.phases, 0),
      {
        ...at(value.phases, 1),
        start: { kind: 'age', person: 'primary', ageMonths: 1806 },
      },
    ]
    expect(at(compiled(value).phases, 1).primaryAgeMonths).toBe(1806)
  })

  it('rejects calendar overflow without throwing', () => {
    rejected(
      { ...input(), startMonth: '9999-12', horizonMonths: 1 },
      'horizonMonths',
    )
  })

  it.each([
    ['id', ''],
    ['id', '  '],
    ['id', ' savings '],
    ['label', ''],
    ['label', ' savings '],
    ['label', null],
    ['kind', 'other'],
    ['owner', 'someone'],
    ['startingBalanceCents', -1],
    ['startingBalanceCents', 0.5],
    ['startingBalanceCents', Number.MAX_SAFE_INTEGER + 1],
    ['startingBalanceCents', Infinity],
    ['startingBalanceCents', '100'],
    ['settings', null],
  ])('rejects invalid account %s: %s', (key, value) => {
    rejected(
      { ...input(), accounts: [{ ...at(input().accounts, 0), [key]: value }] },
      `accounts.0.${key}`,
    )
  })

  it.each([
    ['monthlyContributionCents', -1],
    ['monthlyContributionCents', 1.1],
    ['monthlyContributionCents', Number.MAX_SAFE_INTEGER + 1],
    ['monthlyContributionCents', undefined],
    ['monthlyWithdrawalCents', NaN],
    ['monthlyWithdrawalCents', Infinity],
    ['monthlyWithdrawalCents', '0'],
    ['monthlyWithdrawalCents', -1],
    ['annualFeeRate', -0.1],
    ['annualFeeRate', 1.1],
    ['annualFeeRate', Infinity],
    ['annualFeeRate', null],
    ['rate', null],
  ])('validates defaults and overrides for %s: %s', (key, value) => {
    const plan = input()
    rejected(
      {
        ...plan,
        accounts: [
          {
            ...at(plan.accounts, 0),
            settings: { ...settings(), [key]: value },
          },
        ],
      },
      `accounts.0.settings.${key}`,
    )
    rejected(
      {
        ...plan,
        phases: [
          {
            ...at(plan.phases, 0),
            changes: [{ accountId: 'savings', [key]: value }],
          },
        ],
      },
      `phases.0.changes.0.${key}`,
    )
  })

  it.each([
    [{ kind: 'effective', annualRate: -1.01 }, 'annualRate'],
    [{ kind: 'effective', annualRate: NaN }, 'annualRate'],
    [{ kind: 'effective', annualRate: Infinity }, 'annualRate'],
    [{ kind: 'effective', annualRate: '0.1' }, 'annualRate'],
    [{ kind: 'nominal', annualRate: -0.01, periodsPerYear: 12 }, 'annualRate'],
    [{ kind: 'nominal', annualRate: 0.1 }, 'periodsPerYear'],
    [{ kind: 'nominal', annualRate: 0.1, periodsPerYear: 3 }, 'periodsPerYear'],
    [
      { kind: 'nominal', annualRate: 0.1, periodsPerYear: '12' },
      'periodsPerYear',
    ],
    [
      { kind: 'nominal', annualRate: 0.1, periodsPerYear: 1.5 },
      'periodsPerYear',
    ],
    [
      { kind: 'effective', annualRate: 0.1, periodsPerYear: 12 },
      'periodsPerYear',
    ],
    [{ kind: 'unknown', annualRate: 0.1 }, 'kind'],
    [{ kind: 'effective' }, 'annualRate'],
    [[], ''],
  ])('rejects malformed rate %j in defaults and overrides', (rate, suffix) => {
    const plan = input()
    const tail = suffix ? `.${suffix}` : ''
    rejected(
      {
        ...plan,
        accounts: [
          { ...at(plan.accounts, 0), settings: { ...settings(), rate } },
        ],
      },
      `accounts.0.settings.rate${tail}`,
    )
    rejected(
      {
        ...plan,
        phases: [
          { ...at(plan.phases, 0), changes: [{ accountId: 'savings', rate }] },
        ],
      },
      `phases.0.changes.0.rate${tail}`,
    )
  })

  it.each([
    [{ kind: 'age', person: 'primary', ageMonths: 707 }, 'ageMonths'],
    [{ kind: 'age', person: 'primary', ageMonths: 708 }, 'ageMonths'],
    [{ kind: 'age', person: 'primary', ageMonths: 732 }, 'ageMonths'],
    [{ kind: 'age', person: 'primary', ageMonths: 733 }, 'ageMonths'],
    [{ kind: 'age', person: 'primary', ageMonths: -1 }, 'ageMonths'],
    [{ kind: 'age', person: 'primary', ageMonths: 714.5 }, 'ageMonths'],
    [
      {
        kind: 'age',
        person: 'primary',
        ageMonths: Number.MAX_SAFE_INTEGER + 1,
      },
      'ageMonths',
    ],
    [
      { kind: 'age', person: 'primary', ageMonths: Number.MAX_SAFE_INTEGER },
      'ageMonths',
    ],
    [{ kind: 'age', person: 'primary', ageMonths: NaN }, 'ageMonths'],
    [{ kind: 'age', person: 'primary', ageMonths: '714' }, 'ageMonths'],
    [{ kind: 'age', person: 'other', ageMonths: 714 }, 'person'],
    [{ kind: 'plan-start' }, 'kind'],
    [{ kind: 'other' }, 'kind'],
  ])('rejects invalid later start %j', (start, suffix) => {
    rejected(
      {
        ...input(),
        phases: [at(input().phases, 0), { ...at(input().phases, 1), start }],
      },
      `phases.1.start.${suffix}`,
    )
  })

  it('rejects a non-plan-start first phase even when its offset would be zero', () => {
    rejected(
      {
        ...input(),
        phases: [
          {
            ...at(input().phases, 0),
            start: { kind: 'age', person: 'primary', ageMonths: 708 },
          },
        ],
      },
      'phases.0.start.kind',
    )
  })

  it.each([713, 714])(
    'rejects crossed or duplicate starts across different person anchors',
    (age) => {
      const value = input()
      value.phases = [
        at(value.phases, 0),
        at(value.phases, 1),
        {
          ...at(value.phases, 2),
          start: { kind: 'age', person: 'partner', ageMonths: age - 24 },
        },
      ]
      rejected(value, 'phases.2.start.ageMonths')
    },
  )

  it('rejects an absent-partner age anchor', () => {
    const value = input()
    value.partnerAgeMonths = null
    value.accounts = [{ ...at(value.accounts, 0), owner: 'primary' }]
    rejected(value, 'phases.2.start.person')
  })

  it.each(['partner', 'joint'] as const)(
    'requires a partner for %s ownership',
    (owner) => {
      rejected(
        {
          ...input(),
          partnerAgeMonths: null,
          accounts: [{ ...at(input().accounts, 0), owner }],
          phases: [at(input().phases, 0)],
        },
        'accounts.0.owner',
      )
    },
  )

  it.each(['traditional-401k', 'roth-401k', 'traditional-ira', 'roth-ira'])(
    'rejects joint retirement account %s',
    (kind) => {
      rejected(
        { ...input(), accounts: [{ ...at(input().accounts, 0), kind }] },
        'accounts.0.owner',
      )
    },
  )

  it('rejects aggregate accounts mixed with any other account', () => {
    rejected(
      {
        ...input(),
        accounts: [
          at(input().accounts, 0),
          { ...at(input().accounts, 0), id: 'aggregate', kind: 'aggregate' },
        ],
      },
      'accounts.1.kind',
    )
  })

  it('rejects duplicate IDs, missing references and repeated account changes', () => {
    rejected(
      {
        ...input(),
        accounts: [at(input().accounts, 0), at(input().accounts, 0)],
      },
      'accounts.1.id',
    )
    rejected(
      {
        ...input(),
        phases: [
          at(input().phases, 0),
          { ...at(input().phases, 1), id: 'now' },
        ],
      },
      'phases.1.id',
    )
    rejected(
      {
        ...input(),
        phases: [
          { ...at(input().phases, 0), changes: [{ accountId: 'missing' }] },
        ],
      },
      'phases.0.changes.0.accountId',
    )
    rejected(
      {
        ...input(),
        phases: [
          {
            ...at(input().phases, 0),
            changes: [{ accountId: 'savings' }, { accountId: 'savings' }],
          },
        ],
      },
      'phases.0.changes.1.accountId',
    )
  })

  it.each([
    ['id', ''],
    ['id', ' now '],
    ['label', ''],
    ['label', ' Now '],
    ['changes', null],
    ['changes', {}],
    ['start', null],
    ['start', []],
  ])('rejects malformed phase %s', (key, value) => {
    rejected(
      {
        ...input(),
        phases: [{ ...at(input().phases, 0), [key]: value }],
      },
      `phases.0.${key}`,
    )
  })

  it.each([null, [], 1])(
    'rejects malformed collection elements %s',
    (value) => {
      rejected({ ...input(), accounts: [value] }, 'accounts.0')
      rejected({ ...input(), phases: [value] }, 'phases.0')
      rejected(
        {
          ...input(),
          phases: [{ ...at(input().phases, 0), changes: [value] }],
        },
        'phases.0.changes.0',
      )
    },
  )

  it('rejects sparse arrays and malformed reference IDs', () => {
    rejected({ ...input(), accounts: Array(1) }, 'accounts.0')
    rejected({ ...input(), phases: Array(1) }, 'phases.0')
    rejected(
      {
        ...input(),
        phases: [{ ...at(input().phases, 0), changes: Array(1) }],
      },
      'phases.0.changes.0',
    )
    rejected(
      {
        ...input(),
        phases: [
          { ...at(input().phases, 0), changes: [{ accountId: ' savings ' }] },
        ],
      },
      'phases.0.changes.0.accountId',
    )
  })

  it('rejects unknown keys at every object boundary with precise paths', () => {
    const value = input()
    rejected({ ...value, extra: true }, 'extra')
    rejected(
      { ...value, accounts: [{ ...at(value.accounts, 0), extra: true }] },
      'accounts.0.extra',
    )
    rejected(
      {
        ...value,
        accounts: [
          {
            ...at(value.accounts, 0),
            settings: { ...settings(), extra: true },
          },
        ],
      },
      'accounts.0.settings.extra',
    )
    rejected(
      {
        ...value,
        accounts: [
          {
            ...at(value.accounts, 0),
            settings: {
              ...settings(),
              rate: { kind: 'effective', annualRate: 0, extra: true },
            },
          },
        ],
      },
      'accounts.0.settings.rate.extra',
    )
    rejected(
      {
        ...value,
        phases: [{ ...at(value.phases, 0), extra: true }],
      },
      'phases.0.extra',
    )
    rejected(
      {
        ...value,
        phases: [
          {
            ...at(value.phases, 0),
            start: { kind: 'plan-start', extra: true },
          },
        ],
      },
      'phases.0.start.extra',
    )
    rejected(
      {
        ...value,
        phases: [
          at(value.phases, 0),
          {
            ...at(value.phases, 1),
            start: {
              kind: 'age',
              person: 'primary',
              ageMonths: 714,
              extra: true,
            },
          },
        ],
      },
      'phases.1.start.extra',
    )
    rejected(
      {
        ...value,
        phases: [
          {
            ...at(value.phases, 0),
            changes: [{ accountId: 'savings', extra: true }],
          },
        ],
      },
      'phases.0.changes.0.extra',
    )
    rejected(
      {
        ...value,
        phases: [
          {
            ...at(value.phases, 0),
            changes: [
              {
                accountId: 'savings',
                rate: {
                  kind: 'nominal',
                  annualRate: 0,
                  periodsPerYear: 12,
                  extra: true,
                },
              },
            ],
          },
        ],
      },
      'phases.0.changes.0.rate.extra',
    )
  })

  it('returns structured errors for non-enumerable and symbol unknown fields', () => {
    const value = input()
    Object.defineProperty(value, 'hidden', { value: true })
    rejected(value, 'hidden')
    rejected({ ...input(), [Symbol('extra')]: true }, 'Symbol(extra)')
  })
})
