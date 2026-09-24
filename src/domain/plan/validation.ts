import type {
  AccountChange,
  AccountKind,
  AccountOwner,
  AccountSettings,
  PersonId,
  PlanAccount,
  PlanInput,
  PlanIssue,
  PlanPhase,
  RateAssumption,
} from './types'

const settingKeys = [
  'monthlyContributionCents',
  'monthlyWithdrawalCents',
  'annualFeeRate',
  'rate',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function object(
  value: unknown,
  path: string,
  keys: readonly string[],
  errors: PlanIssue[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    errors.push({ path: path || 'input', message: 'Provide an object.' })
    return undefined
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) {
      errors.push({
        path: path ? `${path}.${String(key)}` : String(key),
        message: 'Unknown field. Remove this unsupported field.',
      })
    }
  }
  return value
}

export function text(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    errors.push({ path, message: 'Enter a nonempty, trimmed string.' })
    return undefined
  }
  return value
}

export function integer(
  value: unknown,
  path: string,
  min: number,
  max: number,
  message: string,
  errors: PlanIssue[],
): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    errors.push({ path, message })
    return undefined
  }
  return value
}

export function money(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): number | undefined {
  return integer(
    value,
    path,
    0,
    Number.MAX_SAFE_INTEGER,
    'Enter nonnegative whole cents within the safe-integer range (0–9007199254740991).',
    errors,
  )
}

function fee(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    errors.push({
      path,
      message: 'Enter a finite annual fee rate from 0 to 1.',
    })
    return undefined
  }
  return value
}

function person(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): PersonId | undefined {
  if (value !== 'primary' && value !== 'partner') {
    errors.push({ path, message: 'Choose primary or partner.' })
    return undefined
  }
  return value
}

function owner(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): AccountOwner | undefined {
  if (value === 'joint') return value
  return person(value, path, errors)
}

function accountKind(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): AccountKind | undefined {
  switch (value) {
    case 'aggregate':
    case 'savings':
    case 'taxable':
    case 'traditional-401k':
    case 'roth-401k':
    case 'traditional-ira':
    case 'roth-ira':
      return value
    default:
      errors.push({ path, message: 'Choose a supported account kind.' })
      return undefined
  }
}

function rate(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): RateAssumption | undefined {
  const fields = object(
    value,
    path,
    ['kind', 'annualRate', 'periodsPerYear'],
    errors,
  )
  if (!fields) return undefined
  const kind = fields.kind
  if (kind !== 'effective' && kind !== 'nominal') {
    errors.push({
      path: `${path}.kind`,
      message: 'Choose effective or nominal.',
    })
    return undefined
  }
  if (
    kind === 'effective' &&
    Object.prototype.hasOwnProperty.call(fields, 'periodsPerYear')
  ) {
    errors.push({
      path: `${path}.periodsPerYear`,
      message:
        'Unknown field for an effective rate. Compounding periods apply only to nominal rates.',
    })
  }
  const annualRate = fields.annualRate
  const validRate =
    typeof annualRate === 'number' &&
    Number.isFinite(annualRate) &&
    annualRate >= (kind === 'effective' ? -1 : 0)
  if (!validRate) {
    errors.push({
      path: `${path}.annualRate`,
      message:
        kind === 'effective'
          ? 'Enter a finite effective annual rate of at least -1.'
          : 'Enter a finite nominal annual rate of at least 0.',
    })
  }
  if (kind === 'effective') {
    return validRate ? { kind, annualRate } : undefined
  }
  const periodsPerYear = fields.periodsPerYear
  if (
    periodsPerYear !== 1 &&
    periodsPerYear !== 2 &&
    periodsPerYear !== 4 &&
    periodsPerYear !== 12 &&
    periodsPerYear !== 365
  ) {
    errors.push({
      path: `${path}.periodsPerYear`,
      message:
        'Choose an explicit compounding frequency: 1, 2, 4, 12, or 365 periods per year.',
    })
    return undefined
  }
  return validRate ? { kind, annualRate, periodsPerYear } : undefined
}

function settings(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): AccountSettings | undefined {
  const fields = object(value, path, settingKeys, errors)
  if (!fields) return undefined
  const monthlyContributionCents = money(
    fields.monthlyContributionCents,
    `${path}.monthlyContributionCents`,
    errors,
  )
  const monthlyWithdrawalCents = money(
    fields.monthlyWithdrawalCents,
    `${path}.monthlyWithdrawalCents`,
    errors,
  )
  const annualFeeRate = fee(
    fields.annualFeeRate,
    `${path}.annualFeeRate`,
    errors,
  )
  const assumption = rate(fields.rate, `${path}.rate`, errors)
  if (
    monthlyContributionCents === undefined ||
    monthlyWithdrawalCents === undefined ||
    annualFeeRate === undefined ||
    assumption === undefined
  )
    return undefined
  return {
    monthlyContributionCents,
    monthlyWithdrawalCents,
    annualFeeRate,
    rate: assumption,
  }
}

function account(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): PlanAccount | undefined {
  const fields = object(
    value,
    path,
    [
      'id',
      'label',
      'kind',
      'owner',
      'startingBalanceCents',
      'priorYearEndBalanceCents',
      'settings',
    ],
    errors,
  )
  if (!fields) return undefined
  const id = text(fields.id, `${path}.id`, errors)
  const label = text(fields.label, `${path}.label`, errors)
  const kind = accountKind(fields.kind, `${path}.kind`, errors)
  const ownership = owner(fields.owner, `${path}.owner`, errors)
  const startingBalanceCents = money(
    fields.startingBalanceCents,
    `${path}.startingBalanceCents`,
    errors,
  )
  const defaults = settings(fields.settings, `${path}.settings`, errors)
  const priorYearEndBalanceCents = Object.prototype.hasOwnProperty.call(
    fields,
    'priorYearEndBalanceCents',
  )
    ? money(
        fields.priorYearEndBalanceCents,
        `${path}.priorYearEndBalanceCents`,
        errors,
      )
    : undefined
  if (
    id === undefined ||
    label === undefined ||
    kind === undefined ||
    ownership === undefined ||
    startingBalanceCents === undefined ||
    defaults === undefined
  )
    return undefined
  return {
    id,
    label,
    kind,
    owner: ownership,
    startingBalanceCents,
    ...(priorYearEndBalanceCents === undefined
      ? {}
      : { priorYearEndBalanceCents }),
    settings: defaults,
  }
}

function change(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): AccountChange | undefined {
  const fields = object(value, path, ['accountId', ...settingKeys], errors)
  if (!fields) return undefined
  const accountId = text(fields.accountId, `${path}.accountId`, errors)
  const result: AccountChange = { accountId: accountId ?? '' }
  for (const key of settingKeys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue
    if (key === 'rate') {
      const assumption = rate(fields[key], `${path}.${key}`, errors)
      if (assumption !== undefined) result.rate = assumption
    } else {
      const amount =
        key === 'annualFeeRate'
          ? fee(fields[key], `${path}.${key}`, errors)
          : money(fields[key], `${path}.${key}`, errors)
      if (amount !== undefined) result[key] = amount
    }
  }
  return accountId === undefined ? undefined : result
}

function phaseStart(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): PlanPhase['start'] | undefined {
  const fields = object(value, path, ['kind', 'person', 'ageMonths'], errors)
  if (!fields) return undefined
  if (fields.kind === 'plan-start') {
    for (const key of ['person', 'ageMonths']) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        errors.push({
          path: `${path}.${key}`,
          message: 'Unknown field for a plan-start anchor.',
        })
      }
    }
    return { kind: 'plan-start' }
  }
  if (fields.kind !== 'age') {
    errors.push({ path: `${path}.kind`, message: 'Choose plan-start or age.' })
    return undefined
  }
  const anchoredPerson = person(fields.person, `${path}.person`, errors)
  const ageMonths = integer(
    fields.ageMonths,
    `${path}.ageMonths`,
    0,
    Number.MAX_SAFE_INTEGER,
    'Enter whole age months in the supported safe-integer range (0–9007199254740991).',
    errors,
  )
  if (anchoredPerson === undefined || ageMonths === undefined) return undefined
  return { kind: 'age', person: anchoredPerson, ageMonths }
}

export function collection<T>(
  value: unknown,
  path: string,
  nonempty: boolean,
  parse: (
    item: unknown,
    itemPath: string,
    issues: PlanIssue[],
  ) => T | undefined,
  errors: PlanIssue[],
): T[] | undefined {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) {
    errors.push({
      path,
      message: nonempty ? 'Provide a nonempty array.' : 'Provide an array.',
    })
    return undefined
  }
  const result: T[] = []
  let valid = true
  for (let i = 0; i < value.length; i++) {
    const item = parse(value[i], `${path}.${i}`, errors)
    if (item === undefined) valid = false
    else result.push(item)
  }
  return valid ? result : undefined
}

function phase(
  value: unknown,
  path: string,
  errors: PlanIssue[],
): PlanPhase | undefined {
  const fields = object(
    value,
    path,
    ['id', 'label', 'start', 'changes'],
    errors,
  )
  if (!fields) return undefined
  const id = text(fields.id, `${path}.id`, errors)
  const label = text(fields.label, `${path}.label`, errors)
  const start = phaseStart(fields.start, `${path}.start`, errors)
  const changes = collection(
    fields.changes,
    `${path}.changes`,
    false,
    change,
    errors,
  )
  if (
    id === undefined ||
    label === undefined ||
    start === undefined ||
    changes === undefined
  )
    return undefined
  return { id, label, start, changes }
}

/** Zero-based month index; deliberately independent of time zones and day lengths. */
export function monthIndex(value: string): number {
  return (Number(value.slice(0, 4)) - 1) * 12 + Number(value.slice(5, 7)) - 1
}

export function parsePlan(
  value: unknown,
  errors: PlanIssue[],
): PlanInput | undefined {
  const fields = object(
    value,
    '',
    [
      'startMonth',
      'horizonMonths',
      'primaryAgeMonths',
      'partnerAgeMonths',
      'accounts',
      'phases',
    ],
    errors,
  )
  if (!fields) return undefined
  const startMonth = fields.startMonth
  const validMonth =
    typeof startMonth === 'string' &&
    startMonth.length === 7 &&
    /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(startMonth)
  if (!validMonth) {
    errors.push({
      path: 'startMonth',
      message:
        'Enter YYYY-MM with a year from 0001 to 9999 and month from 01 to 12.',
    })
  }
  const horizonMonths = integer(
    fields.horizonMonths,
    'horizonMonths',
    1,
    1_200,
    'Enter a whole horizon from 1 to 1200 months.',
    errors,
  )
  const ageMessage =
    'Enter whole age months in the supported input range 0–1800; this is not a longevity prediction.'
  const primaryAgeMonths = integer(
    fields.primaryAgeMonths,
    'primaryAgeMonths',
    0,
    1_800,
    ageMessage,
    errors,
  )
  const partnerAgeMonths =
    fields.partnerAgeMonths === null
      ? null
      : integer(
          fields.partnerAgeMonths,
          'partnerAgeMonths',
          0,
          1_800,
          ageMessage,
          errors,
        )
  const accounts = collection(
    fields.accounts,
    'accounts',
    true,
    account,
    errors,
  )
  const phases = collection(fields.phases, 'phases', true, phase, errors)
  if (
    !validMonth ||
    horizonMonths === undefined ||
    primaryAgeMonths === undefined ||
    partnerAgeMonths === undefined ||
    accounts === undefined ||
    phases === undefined ||
    errors.length > 0
  )
    return undefined
  return {
    startMonth,
    horizonMonths,
    primaryAgeMonths,
    partnerAgeMonths,
    accounts,
    phases,
  }
}

export function resolveOffsets(
  input: PlanInput,
  errors: PlanIssue[],
): number[] {
  if (monthIndex(input.startMonth) + input.horizonMonths >= 9_999 * 12) {
    errors.push({
      path: 'horizonMonths',
      message:
        'The end-exclusive month must remain within calendar years 0001–9999.',
    })
  }
  const accountIds = new Set<string>()
  input.accounts.forEach((account, index) => {
    const path = `accounts.${index}`
    if (accountIds.has(account.id)) {
      errors.push({
        path: `${path}.id`,
        message: 'Account IDs must be unique.',
      })
    }
    accountIds.add(account.id)
    if (account.owner !== 'primary' && input.partnerAgeMonths === null) {
      errors.push({
        path: `${path}.owner`,
        message: 'Partner or joint ownership requires a partner.',
      })
    }
    if (
      account.owner === 'joint' &&
      account.kind !== 'aggregate' &&
      account.kind !== 'savings' &&
      account.kind !== 'taxable'
    ) {
      errors.push({
        path: `${path}.owner`,
        message: 'Retirement accounts cannot have joint ownership.',
      })
    }
    if (account.kind === 'aggregate' && input.accounts.length !== 1) {
      errors.push({
        path: `${path}.kind`,
        message: 'An aggregate account must be the only account in the plan.',
      })
    }
  })
  const phaseIds = new Set<string>()
  const offsets: number[] = []
  let previousOffset = -1
  input.phases.forEach((phase, index) => {
    const path = `phases.${index}`
    if (phaseIds.has(phase.id)) {
      errors.push({ path: `${path}.id`, message: 'Phase IDs must be unique.' })
    }
    phaseIds.add(phase.id)
    const changedIds = new Set<string>()
    phase.changes.forEach((change, changeIndex) => {
      const changePath = `${path}.changes.${changeIndex}.accountId`
      if (!accountIds.has(change.accountId)) {
        errors.push({
          path: changePath,
          message: 'The referenced account does not exist.',
        })
      }
      if (changedIds.has(change.accountId)) {
        errors.push({
          path: changePath,
          message: 'An account can be changed only once in each phase.',
        })
      }
      changedIds.add(change.accountId)
    })
    if (index === 0 && phase.start.kind !== 'plan-start') {
      errors.push({
        path: `${path}.start.kind`,
        message: 'The first phase must start at plan-start.',
      })
    }
    if (index !== 0 && phase.start.kind === 'plan-start') {
      errors.push({
        path: `${path}.start.kind`,
        message: 'Only the first phase may use plan-start.',
      })
    }
    let offset = 0
    if (phase.start.kind === 'age') {
      const startingAge =
        phase.start.person === 'primary'
          ? input.primaryAgeMonths
          : input.partnerAgeMonths
      if (startingAge === null) {
        errors.push({
          path: `${path}.start.person`,
          message: 'A partner age anchor requires a partner.',
        })
        return
      }
      offset = phase.start.ageMonths - startingAge
      if (offset < 0) {
        errors.push({
          path: `${path}.start.ageMonths`,
          message:
            'The anchor age cannot be earlier than the person’s starting age.',
        })
      }
      if (offset >= input.horizonMonths) {
        errors.push({
          path: `${path}.start.ageMonths`,
          message:
            'The phase must start before the end-exclusive plan horizon.',
        })
      }
      if (offset <= previousOffset) {
        errors.push({
          path: `${path}.start.ageMonths`,
          message:
            'Phase starts must be strictly increasing in the supplied order; duplicate or crossed starts are not allowed.',
        })
      }
    }
    offsets.push(offset)
    previousOffset = offset
  })
  return offsets
}
