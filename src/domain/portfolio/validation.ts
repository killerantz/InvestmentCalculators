import type { PortfolioInput, PortfolioIssue } from './types'

export function validatePortfolioInput(
  input: unknown,
  errors: PortfolioIssue[],
): input is PortfolioInput {
  function issue(path: string, message: string) {
    errors.push({ path, message })
  }
  function object(value: unknown, path: string, keys: string[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issue(path, 'Provide an object.')
      return undefined
    }
    const result = value as Record<string, unknown>
    for (const key of Object.keys(result)) {
      if (!keys.includes(key)) issue(`${path}.${key}`, 'Unsupported field.')
    }
    return result
  }
  function text(value: unknown, path: string) {
    if (typeof value !== 'string' || !value.trim())
      issue(path, 'Enter nonempty text.')
  }
  function number(
    value: unknown,
    path: string,
    min: number,
    max: number,
    integer = false,
  ) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isSafeInteger(value))
    ) {
      issue(
        path,
        `Enter ${integer ? 'whole ' : ''}numbers from ${min} to ${max}.`,
      )
    }
  }
  function money(value: unknown, path: string) {
    number(value, path, 0, Number.MAX_SAFE_INTEGER, true)
  }
  function choice(value: unknown, path: string, choices: string[]) {
    if (typeof value !== 'string' || !choices.includes(value))
      issue(path, `Choose ${choices.join(', ')}.`)
  }
  const root = object(input, 'input', [
    'startMonth',
    'months',
    'ordinaryTaxRate',
    'qualifiedDividendTaxRate',
    'realizedGainTaxRate',
    'accounts',
  ])
  if (!root) return false
  const validDate =
    typeof root.startMonth === 'string' &&
    /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(root.startMonth)
  if (!validDate)
    issue(
      'startMonth',
      'Enter a calendar month from 0001-01 through 9999-12 (YYYY-MM).',
    )
  number(root.months, 'months', 1, 1200, true)
  if (validDate && typeof root.months === 'number') {
    const year = Number((root.startMonth as string).slice(0, 4))
    const month = Number((root.startMonth as string).slice(5))
    if (year * 12 + month - 1 + root.months - 1 > 9999 * 12 + 11)
      issue('months', 'The projection must end by 9999-12.')
  }
  for (const key of [
    'ordinaryTaxRate',
    'qualifiedDividendTaxRate',
    'realizedGainTaxRate',
  ])
    number(root[key], key, 0, 1)
  if (!Array.isArray(root.accounts) || !root.accounts.length) {
    issue('accounts', 'Provide at least one taxable brokerage account.')
    return false
  }
  const accountIds = new Set<unknown>()
  Array.from(root.accounts).forEach((raw: unknown, index: number) => {
    const path = `accounts[${index}]`
    const account = object(raw, path, [
      'id',
      'name',
      'startingCashCents',
      'monthlyContributionCents',
      'distributionMode',
      'rebalance',
      'driftThreshold',
      'assets',
    ])
    if (!account) return
    text(account.id, `${path}.id`)
    text(account.name, `${path}.name`)
    if (accountIds.has(account.id))
      issue(`${path}.id`, 'Account IDs must be unique.')
    accountIds.add(account.id)
    money(account.startingCashCents, `${path}.startingCashCents`)
    money(account.monthlyContributionCents, `${path}.monthlyContributionCents`)
    choice(account.distributionMode, `${path}.distributionMode`, [
      'reinvest',
      'retain',
    ])
    choice(account.rebalance, `${path}.rebalance`, [
      'none',
      'annual',
      'threshold',
    ])
    number(account.driftThreshold, `${path}.driftThreshold`, Number.EPSILON, 1)
    if (!Array.isArray(account.assets) || !account.assets.length) {
      issue(`${path}.assets`, 'Provide at least one asset.')
      return
    }
    const ids = new Set<unknown>()
    let weight = 0
    Array.from(account.assets).forEach(
      (rawAsset: unknown, assetIndex: number) => {
        const assetPath = `${path}.assets[${assetIndex}]`
        const asset = object(rawAsset, assetPath, [
          'id',
          'name',
          'type',
          'marketValueCents',
          'costBasisCents',
          'targetWeight',
          'annualPriceGrowthRate',
          'annualDistributionYield',
          'qualifiedDividendShare',
        ])
        if (!asset) return
        text(asset.id, `${assetPath}.id`)
        text(asset.name, `${assetPath}.name`)
        if (ids.has(asset.id))
          issue(
            `${assetPath}.id`,
            'Asset IDs must be unique within their account.',
          )
        ids.add(asset.id)
        choice(asset.type, `${assetPath}.type`, ['stock', 'bond'])
        money(asset.marketValueCents, `${assetPath}.marketValueCents`)
        money(asset.costBasisCents, `${assetPath}.costBasisCents`)
        number(asset.targetWeight, `${assetPath}.targetWeight`, 0, 1)
        if (typeof asset.targetWeight === 'number') weight += asset.targetWeight
        number(
          asset.annualPriceGrowthRate,
          `${assetPath}.annualPriceGrowthRate`,
          -1,
          100,
        )
        if (asset.annualPriceGrowthRate === -1)
          issue(
            `${assetPath}.annualPriceGrowthRate`,
            'Annual price growth must be strictly greater than -100%.',
          )
        number(
          asset.annualDistributionYield,
          `${assetPath}.annualDistributionYield`,
          0,
          10,
        )
        number(
          asset.qualifiedDividendShare,
          `${assetPath}.qualifiedDividendShare`,
          0,
          1,
        )
        if (asset.type === 'bond' && asset.qualifiedDividendShare !== 0)
          issue(
            `${assetPath}.qualifiedDividendShare`,
            'Bond distributions are ordinary interest; enter zero.',
          )
      },
    )
    if (!Number.isFinite(weight) || Math.abs(weight - 1) > 1e-10)
      issue(
        `${path}.assets`,
        'Target allocations must total 100% of the invested asset sleeve, excluding cash.',
      )
  })
  return errors.length === 0
}
