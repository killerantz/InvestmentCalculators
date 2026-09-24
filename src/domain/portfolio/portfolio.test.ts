import { describe, expect, it } from 'vitest'
import { runPortfolioProjection } from './index'
import type {
  PortfolioAccountInput,
  PortfolioAssetInput,
  PortfolioInput,
  PortfolioProjection,
} from './index'

const asset = (
  overrides: Partial<PortfolioAssetInput> = {},
): PortfolioAssetInput => ({
  id: 'stock',
  name: 'Synthetic stock',
  type: 'stock',
  marketValueCents: 100_000,
  costBasisCents: 100_000,
  targetWeight: 1,
  annualPriceGrowthRate: 0,
  annualDistributionYield: 0,
  qualifiedDividendShare: 0,
  ...overrides,
})
const account = (
  overrides: Partial<PortfolioAccountInput> = {},
): PortfolioAccountInput => ({
  id: 'brokerage',
  name: 'Synthetic brokerage',
  startingCashCents: 0,
  monthlyContributionCents: 0,
  distributionMode: 'reinvest',
  rebalance: 'none',
  driftThreshold: 0.05,
  assets: [asset()],
  ...overrides,
})
const input = (overrides: Partial<PortfolioInput> = {}): PortfolioInput => ({
  startMonth: '2026-01',
  months: 1,
  ordinaryTaxRate: 0.2,
  qualifiedDividendTaxRate: 0.1,
  realizedGainTaxRate: 0.2,
  accounts: [account()],
  ...overrides,
})
function run(value: unknown): PortfolioProjection {
  const result = runPortfolioProjection(value)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.projection
}
const monthlyGrowth = (rate: number) => Math.pow(1 + rate, 12) - 1

describe('portfolio accounting', () => {
  it('preserves a zero-growth, zero-yield portfolio and records cash contributions', () => {
    const result = run(
      input({
        months: 12,
        accounts: [
          account({
            startingCashCents: 100,
            monthlyContributionCents: 200,
          }),
        ],
      }),
    )
    expect(result.engineVersion).toBe('portfolio-1.0.0')
    expect(result.totals).toMatchObject({
      endingAssetsCents: 100_000,
      endingBasisCents: 100_000,
      endingCashCents: 2500,
      equityCents: 102_500,
      contributionsCents: 2400,
      taxAssessedCents: 0,
    })
    expect(result.annual[0]!.partial).toBe(false)
  })

  it('splits monthly dividends, assesses tax, and reinvests only the net into original pooled basis', () => {
    const result = run(
      input({
        accounts: [
          account({
            assets: [
              asset({
                annualDistributionYield: 0.12,
                qualifiedDividendShare: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    expect(result.totals).toMatchObject({
      qualifiedDividendsCents: 500,
      ordinaryDividendsCents: 500,
      interestCents: 0,
      distributionTaxCents: 150,
      taxPaidCents: 150,
      purchasesCents: 850,
      endingAssetsCents: 100_850,
      endingBasisCents: 100_850,
      endingCashCents: 0,
      taxLiabilityCents: 0,
    })
    expect(result.accounts[0]!.monthly[0]!.assets[0]!.purchasesCents).toBe(850)
  })

  it('uses post-price-growth yield, without treating distributions as price growth', () => {
    const result = run(
      input({
        accounts: [
          account({
            assets: [
              asset({
                annualPriceGrowthRate: monthlyGrowth(0.1),
                annualDistributionYield: 0.12,
              }),
            ],
          }),
        ],
      }),
    )
    expect(result.totals.growthCents).toBe(10_000)
    expect(result.totals.ordinaryDividendsCents).toBe(1100)
    expect(result.totals.endingAssetsCents).toBe(110_880)
  })

  it('taxes bond yield as ordinary interest and keeps retained distributions as cash', () => {
    const result = run(
      input({
        accounts: [
          account({
            distributionMode: 'retain',
            assets: [asset({ type: 'bond', annualDistributionYield: 0.12 })],
          }),
        ],
      }),
    )
    expect(result.totals).toMatchObject({
      interestCents: 1000,
      qualifiedDividendsCents: 0,
      ordinaryDividendsCents: 0,
      taxPaidCents: 200,
      endingCashCents: 800,
      endingAssetsCents: 100_000,
      endingBasisCents: 100_000,
      purchasesCents: 0,
    })
  })

  it('removes proportional sale basis and settles gain tax before rebalancing purchases', () => {
    const result = run(
      input({
        startMonth: '2026-12',
        accounts: [
          account({
            rebalance: 'annual',
            assets: [
              asset({
                marketValueCents: 20_000,
                costBasisCents: 10_000,
                targetWeight: 0.5,
              }),
              asset({
                id: 'bond',
                type: 'bond',
                marketValueCents: 0,
                costBasisCents: 0,
                targetWeight: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    expect(result.totals).toMatchObject({
      salesCents: 10_000,
      realizedGainsCents: 5000,
      capitalGainTaxCents: 1000,
      purchasesCents: 9000,
      endingAssetsCents: 19_000,
      endingBasisCents: 14_000,
      taxPaidCents: 1000,
      rebalanceCount: 1,
    })
    expect(result.accounts[0]!.monthly[0]!.assets[0]).toMatchObject({
      basisSoldCents: 5000,
      endingValueCents: 10_000,
      endingBasisCents: 5000,
    })
  })

  it('nets gains and losses in one calendar year and removes full-liquidation basis exactly', () => {
    const result = run(
      input({
        accounts: [
          account({
            rebalance: 'threshold',
            assets: [
              asset({
                id: 'gain',
                marketValueCents: 10_000,
                costBasisCents: 5001,
                targetWeight: 0,
              }),
              asset({
                id: 'loss',
                marketValueCents: 10_000,
                costBasisCents: 14_999,
                targetWeight: 0,
              }),
              asset({
                id: 'destination',
                marketValueCents: 0,
                costBasisCents: 0,
                targetWeight: 1,
              }),
            ],
          }),
        ],
      }),
    )
    expect(result.totals.realizedGainsCents).toBe(0)
    expect(result.totals.capitalGainTaxCents).toBe(0)
    expect(
      result.accounts[0]!.monthly[0]!.assets.slice(0, 2).map(
        (row) => row.endingBasisCents,
      ),
    ).toEqual([0, 0])
    expect(result.totals.endingBasisCents).toBe(20_000)
  })

  it('resets losses at December with no carryforward or ordinary-income deduction', () => {
    const result = run(
      input({
        startMonth: '2026-12',
        months: 2,
        realizedGainTaxRate: 1,
        accounts: [
          account({
            rebalance: 'threshold',
            driftThreshold: 0.001,
            assets: [
              asset({
                id: 'loss',
                marketValueCents: 10_000,
                costBasisCents: 20_000,
                targetWeight: 0,
              }),
              asset({
                id: 'gain',
                marketValueCents: 10_000,
                costBasisCents: 0,
                targetWeight: 0.5,
                annualPriceGrowthRate: monthlyGrowth(0.1),
              }),
              asset({
                id: 'bond',
                type: 'bond',
                marketValueCents: 0,
                costBasisCents: 0,
                targetWeight: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    const [december, january] = result.accounts[0]!.monthly
    expect(december!.realizedGainsCents).toBe(-9500)
    expect(december!.capitalGainTaxCents).toBe(0)
    expect(january!.realizedGainsCents).toBe(525)
    expect(january!.capitalGainTaxCents).toBe(525)
    expect(january!.netRealizationsYtdCents).toBe(525)
    expect(result.annual.map((row) => row.year)).toEqual([2026, 2027])
  })

  it('offsets earlier losses against later gains in the same calendar year without reducing distribution tax', () => {
    const result = run(
      input({
        startMonth: '2026-11',
        months: 2,
        realizedGainTaxRate: 1,
        accounts: [
          account({
            rebalance: 'threshold',
            driftThreshold: 0.001,
            assets: [
              asset({
                id: 'loss',
                marketValueCents: 10_000,
                costBasisCents: 20_000,
                targetWeight: 0,
              }),
              asset({
                id: 'gain',
                marketValueCents: 10_000,
                costBasisCents: 0,
                targetWeight: 0.5,
                annualPriceGrowthRate: monthlyGrowth(0.1),
                annualDistributionYield: 0.12,
              }),
              asset({
                id: 'bond',
                type: 'bond',
                marketValueCents: 0,
                costBasisCents: 0,
                targetWeight: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    const [november, december] = result.accounts[0]!.monthly
    expect(november!.realizedGainsCents).toBeLessThan(0)
    expect(december!.realizedGainsCents).toBeGreaterThan(0)
    expect(december!.netRealizationsYtdCents).toBe(
      november!.realizedGainsCents + december!.realizedGainsCents,
    )
    expect(result.totals.capitalGainTaxCents).toBe(0)
    expect(result.totals.distributionTaxCents).toBeGreaterThan(0)
    expect(result.totals.taxPaidCents).toBe(result.totals.distributionTaxCents)
  })

  it('defers interim gains and settles at the final partial-year month', () => {
    const result = run(
      input({
        months: 2,
        realizedGainTaxRate: 1,
        accounts: [
          account({
            rebalance: 'threshold',
            driftThreshold: 0.04,
            assets: [
              asset({
                marketValueCents: 10_000,
                costBasisCents: 0,
                targetWeight: 0.5,
                annualPriceGrowthRate: monthlyGrowth(0.2),
              }),
              asset({
                id: 'bond',
                type: 'bond',
                marketValueCents: 10_000,
                costBasisCents: 10_000,
                targetWeight: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    const [first, final] = result.accounts[0]!.monthly
    expect(first!.capitalGainTaxCents).toBe(0)
    expect(first!.purchasesCents).toBe(1000)
    expect(final!.settlement).toBe('partial-year')
    expect(final!.capitalGainTaxCents).toBe(2100)
    expect(final!.salesCents).toBe(1100)
    expect(final!.taxPaidCents).toBe(1100)
    expect(final!.taxLiabilityCents).toBe(1000)
    expect(final!.purchasesCents).toBe(0)
    expect(final!.equityCents).toBe(final!.grossAssetsCents - 1000)
    expect(result.events.some((event) => event.type === 'tax-shortage')).toBe(
      true,
    )
  })

  it('uses future external cash to pay an existing liability before investing', () => {
    const result = run(
      input({
        startMonth: '2026-11',
        months: 3,
        realizedGainTaxRate: 1,
        accounts: [
          account({
            rebalance: 'threshold',
            driftThreshold: 0.04,
            monthlyContributionCents: 100,
            assets: [
              asset({
                marketValueCents: 10_000,
                costBasisCents: 0,
                targetWeight: 0.5,
                annualPriceGrowthRate: monthlyGrowth(0.2),
              }),
              asset({
                id: 'bond',
                type: 'bond',
                marketValueCents: 10_000,
                costBasisCents: 10_000,
                targetWeight: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    const [, december, january] = result.accounts[0]!.monthly
    expect(december!.taxLiabilityCents).toBeGreaterThan(0)
    expect(january!.openingTaxLiabilityCents).toBe(december!.taxLiabilityCents)
    expect(january!.taxPaidCents).toBeGreaterThanOrEqual(100)
    expect(january!.taxLiabilityCents).toBe(
      january!.openingTaxLiabilityCents +
        january!.taxAssessedCents -
        january!.taxPaidCents,
    )
    expect(january!.purchasesCents).toBe(0)
  })

  it('does not net independent account gains against losses', () => {
    const make = (id: string, basis: number) =>
      account({
        id,
        rebalance: 'threshold',
        assets: [
          asset({ targetWeight: 0, costBasisCents: basis }),
          asset({
            id: 'destination',
            marketValueCents: 0,
            costBasisCents: 0,
            targetWeight: 1,
          }),
        ],
      })
    const result = run(
      input({ accounts: [make('gain', 50_000), make('loss', 150_000)] }),
    )
    expect(result.totals.realizedGainsCents).toBe(0)
    expect(result.totals.capitalGainTaxCents).toBe(10_000)
    expect(
      result.accounts.map((item) => item.totals.capitalGainTaxCents),
    ).toEqual([10_000, 0])
  })

  it('triggers calendar rebalances in December, and threshold only at the entered percentage-point drift', () => {
    const base = account({
      rebalance: 'annual',
      startingCashCents: 1000,
      distributionMode: 'retain',
    })
    const result = run(
      input({ startMonth: '2026-11', months: 3, accounts: [base] }),
    )
    expect(result.monthly.map((row) => row.rebalanceCount)).toEqual([0, 1, 0])
    expect(result.monthly[1]!.purchasesCents).toBe(1000)
    const threshold = run(
      input({
        accounts: [
          account({
            rebalance: 'threshold',
            driftThreshold: 0.1,
            assets: [
              asset({ targetWeight: 0.9 }),
              asset({
                id: 'empty',
                marketValueCents: 0,
                costBasisCents: 0,
                targetWeight: 0.1,
              }),
            ],
          }),
        ],
      }),
    )
    expect(threshold.totals.rebalanceCount).toBe(1)
    expect(run(input()).totals.rebalanceCount).toBe(0)
  })

  it('preserves negative growth and losses and reconciles every asset, account, and combined flow', () => {
    const result = run(
      input({
        months: 25,
        accounts: [
          account({
            id: 'a',
            startingCashCents: 999,
            monthlyContributionCents: 1234,
            rebalance: 'annual',
            assets: [
              asset({
                targetWeight: 0.6,
                annualPriceGrowthRate: -0.4,
                annualDistributionYield: 0.06,
                qualifiedDividendShare: 0.3,
              }),
              asset({
                id: 'bond',
                type: 'bond',
                targetWeight: 0.4,
                annualPriceGrowthRate: 0.05,
                annualDistributionYield: 0.12,
              }),
            ],
          }),
          account({
            id: 'b',
            distributionMode: 'retain',
            assets: [asset({ annualPriceGrowthRate: -0.99 })],
          }),
        ],
      }),
    )
    for (const accountResult of result.accounts) {
      for (const row of accountResult.monthly) {
        const distribution =
          row.qualifiedDividendsCents +
          row.ordinaryDividendsCents +
          row.interestCents
        expect(row.endingCashCents).toBe(
          row.openingCashCents +
            row.contributionsCents +
            distribution +
            row.salesCents -
            row.purchasesCents -
            row.taxPaidCents,
        )
        expect(row.endingAssetsCents).toBe(
          row.openingAssetsCents +
            row.growthCents -
            row.salesCents +
            row.purchasesCents,
        )
        expect(row.taxLiabilityCents).toBe(
          row.openingTaxLiabilityCents +
            row.taxAssessedCents -
            row.taxPaidCents,
        )
        expect(row.equityCents).toBe(
          row.grossAssetsCents - row.taxLiabilityCents,
        )
        for (const assetRow of row.assets) {
          expect(assetRow.endingValueCents).toBe(
            assetRow.openingValueCents +
              assetRow.growthCents -
              assetRow.salesCents +
              assetRow.purchasesCents,
          )
          expect(assetRow.endingBasisCents).toBe(
            assetRow.openingBasisCents -
              assetRow.basisSoldCents +
              assetRow.purchasesCents,
          )
          expect(assetRow.realizedGainsCents).toBe(
            assetRow.salesCents - assetRow.basisSoldCents,
          )
        }
        for (const [key, value] of Object.entries(row)) {
          if (key.endsWith('Cents'))
            expect(Number.isSafeInteger(value)).toBe(true)
        }
      }
    }
    for (const [index, row] of result.monthly.entries())
      expect(row.equityCents).toBe(
        result.accounts.reduce(
          (total, a) => total + a.monthly[index]!.equityCents,
          0,
        ),
      )
    expect(result.totals.growthCents).toBeLessThan(0)
    expect(result.totals.equityCents).toBe(
      result.totals.openingAssetsCents +
        result.totals.openingCashCents +
        result.totals.growthCents +
        result.totals.contributionsCents +
        result.totals.qualifiedDividendsCents +
        result.totals.ordinaryDividendsCents +
        result.totals.interestCents -
        result.totals.taxAssessedCents,
    )
  })

  it('isolates repeated projections and input snapshots', () => {
    const value = input()
    const first = run(value)
    const second = run(value)
    expect(first).toEqual(second)
    expect(first.assumptions.accounts[0]).not.toBe(value.accounts[0])
    expect(first.assumptions.accounts[0]!.assets[0]).not.toBe(
      value.accounts[0]!.assets[0],
    )
    value.accounts[0]!.assets[0]!.marketValueCents = 0
    expect(first.assumptions.accounts[0]!.assets[0]!.marketValueCents).toBe(
      100_000,
    )
  })
})

describe('portfolio validation and numeric limits', () => {
  it('rejects missing array entries instead of skipping validation or crashing', () => {
    const missingAccounts = input({
      accounts: new Array<PortfolioAccountInput>(1),
    })
    const missingAssets = input({
      accounts: [account({ assets: new Array<PortfolioAssetInput>(1) })],
    })
    expect(runPortfolioProjection(missingAccounts)).toMatchObject({
      ok: false,
      errors: [{ path: 'accounts[0]' }],
    })
    const result = runPortfolioProjection(missingAssets)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]!.path).toBe('accounts[0].assets[0]')
  })

  it('supports tax-free and 100%-taxed distributions without negative purchases or excess taxes', () => {
    for (const rate of [0, 1]) {
      const result = run(
        input({
          ordinaryTaxRate: rate,
          qualifiedDividendTaxRate: rate,
          accounts: [
            account({
              assets: [
                asset({
                  marketValueCents: 300,
                  costBasisCents: 300,
                  annualDistributionYield: 0.12,
                  qualifiedDividendShare: 0.5,
                }),
              ],
            }),
          ],
        }),
      )
      expect(result.totals.qualifiedDividendsCents).toBe(2)
      expect(result.totals.ordinaryDividendsCents).toBe(1)
      expect(result.totals.taxAssessedCents).toBe(3 * rate)
      expect(result.totals.purchasesCents).toBe(3 * (1 - rate))
    }
  })

  it('reinvests each asset distribution into its own pool, not the highest target deficit', () => {
    const result = run(
      input({
        accounts: [
          account({
            assets: [
              asset({
                targetWeight: 0.2,
                annualDistributionYield: 0.12,
                qualifiedDividendShare: 1,
              }),
              asset({
                id: 'bond',
                type: 'bond',
                targetWeight: 0.8,
                annualDistributionYield: 0.24,
              }),
            ],
          }),
        ],
      }),
    )
    expect(
      result.accounts[0]!.monthly[0]!.assets.map((row) => row.purchasesCents),
    ).toEqual([900, 1600])
  })

  it.each([
    [null, 'input'],
    [{ ...input(), mystery: 1 }, 'input.mystery'],
    [input({ months: 0 }), 'months'],
    [input({ months: 1201 }), 'months'],
    [input({ months: 1.1 }), 'months'],
    [input({ startMonth: '2026-13' }), 'startMonth'],
    [input({ startMonth: '0000-01' }), 'startMonth'],
    [input({ startMonth: '9999-12', months: 2 }), 'months'],
    [input({ ordinaryTaxRate: NaN }), 'ordinaryTaxRate'],
    [input({ qualifiedDividendTaxRate: -0.1 }), 'qualifiedDividendTaxRate'],
    [input({ realizedGainTaxRate: 1.1 }), 'realizedGainTaxRate'],
    [input({ accounts: [] }), 'accounts'],
    [input({ accounts: [account(), account()] }), 'accounts[1].id'],
    [input({ accounts: [account({ assets: [] })] }), 'accounts[0].assets'],
    [
      input({ accounts: [account({ assets: [asset(), asset()] })] }),
      'accounts[0].assets[1].id',
    ],
    [
      input({ accounts: [account({ startingCashCents: 1.5 })] }),
      'accounts[0].startingCashCents',
    ],
    [
      input({ accounts: [account({ driftThreshold: 0 })] }),
      'accounts[0].driftThreshold',
    ],
    [
      input({
        accounts: [account({ assets: [asset({ targetWeight: 0.9 })] })],
      }),
      'accounts[0].assets',
    ],
    [
      input({
        accounts: [account({ assets: [asset({ annualPriceGrowthRate: -1 })] })],
      }),
      'accounts[0].assets[0].annualPriceGrowthRate',
    ],
    [
      input({
        accounts: [
          account({ assets: [asset({ annualDistributionYield: -0.01 })] }),
        ],
      }),
      'accounts[0].assets[0].annualDistributionYield',
    ],
    [
      input({
        accounts: [
          account({ assets: [asset({ annualDistributionYield: Infinity })] }),
        ],
      }),
      'accounts[0].assets[0].annualDistributionYield',
    ],
    [
      input({
        accounts: [
          account({
            assets: [asset({ type: 'bond', qualifiedDividendShare: 0.5 })],
          }),
        ],
      }),
      'accounts[0].assets[0].qualifiedDividendShare',
    ],
  ])('rejects invalid inputs with structured paths', (value, path) => {
    const result = runPortfolioProjection(value)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors.some((error) => error.path === path)).toBe(true)
  })

  it('rejects unknown nested fields and unsupported reference-like properties', () => {
    const result = runPortfolioProjection({
      ...input(),
      accounts: [
        {
          ...account(),
          destinationAccountId: 'missing',
          assets: [{ ...asset(), lotId: 'unknown' }],
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors.map((error) => error.path)).toEqual([
        'accounts[0].destinationAccountId',
        'accounts[0].assets[0].lotId',
      ])
  })

  it('rejects overflow in growth, aggregates, cash, basis, and cumulative amounts without partial success', () => {
    const max = Number.MAX_SAFE_INTEGER
    const cases = [
      input({
        months: 1200,
        accounts: [
          account({ assets: [asset({ annualPriceGrowthRate: 100 })] }),
        ],
      }),
      input({ accounts: [account({ startingCashCents: max })] }),
      input({
        accounts: [
          account({ id: 'a', assets: [asset({ marketValueCents: max })] }),
          account({ id: 'b' }),
        ],
      }),
      input({
        accounts: [
          account({
            assets: [
              asset({ costBasisCents: max, annualDistributionYield: 0.12 }),
            ],
          }),
        ],
      }),
      input({
        months: 1200,
        accounts: [account({ monthlyContributionCents: max })],
      }),
    ]
    for (const value of cases)
      expect(runPortfolioProjection(value)).toMatchObject({
        ok: false,
        errors: [{ path: 'calculation' }],
      })
  })

  it('supports edge dates, maximum horizon, cent ties, and basis larger than value', () => {
    expect(
      run(input({ startMonth: '0001-01', months: 1200 })).monthly.at(-1)!
        .calendarMonth,
    ).toBe('0100-12')
    expect(
      run(input({ startMonth: '9999-12' })).monthly[0]!.calendarMonth,
    ).toBe('9999-12')
    const result = run(
      input({
        accounts: [
          account({
            rebalance: 'threshold',
            assets: [
              asset({
                marketValueCents: 2,
                costBasisCents: 3,
                targetWeight: 0.5,
              }),
              asset({
                id: 'other',
                marketValueCents: 0,
                costBasisCents: 0,
                targetWeight: 0.5,
              }),
            ],
          }),
        ],
      }),
    )
    expect(result.accounts[0]!.monthly[0]!.assets[0]!.basisSoldCents).toBe(2)
    expect(result.totals.realizedGainsCents).toBe(-1)
    expect(
      run(
        input({
          accounts: [
            account({
              assets: [asset({ annualPriceGrowthRate: -0.9999999999999999 })],
            }),
          ],
        }),
      ).totals.endingAssetsCents,
    ).toBeGreaterThanOrEqual(0)
  })
})
