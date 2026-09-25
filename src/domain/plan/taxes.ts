import { cents } from '../numeric'
import type { AccountMonthlyRow, PlanIncomeRow } from './projectionTypes'
import type {
  PlanTaxAccountRow,
  PlanTaxAmounts,
  PlanTaxAssumptions,
  PlanTaxMonthlyRow,
  PlanTaxProjection,
  PlanTaxRates,
} from './taxTypes'
import type { PlanAccount } from './types'

function emptyAmounts(): PlanTaxAmounts {
  return {
    ordinaryIncomeCents: 0,
    capitalGainsCents: 0,
    qualifiedDividendsCents: 0,
    ordinaryDividendsCents: 0,
    ordinaryTaxCents: 0,
    capitalGainsTaxCents: 0,
    qualifiedDividendTaxCents: 0,
    taxAssessedCents: 0,
    taxPaidCents: 0,
    unpaidTaxCents: 0,
  }
}

function summarize(rows: readonly PlanTaxMonthlyRow[]): PlanTaxAmounts {
  const result = emptyAmounts()
  for (const row of rows) {
    for (const field of Object.keys(result) as (keyof PlanTaxAmounts)[])
      result[field] =
        field === 'unpaidTaxCents'
          ? row[field]
          : cents(result[field] + row[field])
  }
  return result
}

function traditional(account: PlanAccount): boolean {
  return (
    account.kind === 'traditional-ira' || account.kind === 'traditional-401k'
  )
}

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new Error('Unresolved validated tax reference.')
  return value
}

/** Exact proportional pooled basis, rounded to cents without unsafe products. */
function removedBasis(basis: number, amount: number, balance: number): number {
  if (amount === 0 || balance === 0) return 0
  const denominator = BigInt(balance)
  return Number(
    (BigInt(basis) * BigInt(amount) * 2n + denominator) / (2n * denominator),
  )
}

/**
 * Event-level cent rounding. Reinvested dividends affect basis and tax only:
 * the account's total-return growth already includes the distribution.
 */
export class PlanTaxLedger {
  private readonly assumptions: PlanTaxAssumptions
  private readonly metadata: Map<string, PlanAccount>
  private readonly basis: Map<string, number>
  private readonly monthly: PlanTaxMonthlyRow[] = []
  private readonly accountRows = new Map<string, PlanTaxAccountRow>()
  private rates: PlanTaxRates
  private amounts = emptyAmounts()
  private unpaid = 0
  private paymentOrder: readonly string[] | null

  constructor(
    assumptions: PlanTaxAssumptions,
    accounts: readonly PlanAccount[],
  ) {
    this.assumptions = assumptions
    this.paymentOrder = assumptions.paymentOrder ?? null
    this.metadata = new Map(accounts.map((account) => [account.id, account]))
    this.basis = new Map(
      assumptions.accounts.map((account) => [
        account.accountId,
        account.costBasisCents,
      ]),
    )
    this.rates = {
      ordinaryRate: assumptions.ordinaryRate,
      capitalGainsRate: assumptions.capitalGainsRate,
      qualifiedDividendRate: assumptions.qualifiedDividendRate,
    }
  }

  enterPhase(phaseId: string): void {
    const override = this.assumptions.phaseRates.find(
      (phase) => phase.phaseId === phaseId,
    )
    if (override?.paymentOrder !== undefined)
      this.paymentOrder = override.paymentOrder
    this.rates = {
      ordinaryRate: override?.ordinaryRate ?? this.rates.ordinaryRate,
      capitalGainsRate:
        override?.capitalGainsRate ?? this.rates.capitalGainsRate,
      qualifiedDividendRate:
        override?.qualifiedDividendRate ?? this.rates.qualifiedDividendRate,
    }
  }

  beginMonth(): void {
    this.amounts = emptyAmounts()
    this.accountRows.clear()
    for (const account of this.metadata.values()) {
      const basis = this.basis.get(account.id) ?? null
      this.accountRows.set(account.id, {
        accountId: account.id,
        openingBasisCents: basis,
        closingBasisCents: basis,
        realizedGainsCents: 0,
        ordinaryIncomeCents: 0,
        qualifiedDividendsCents: 0,
        ordinaryDividendsCents: 0,
        taxAssessedCents: 0,
      })
    }
  }

  private add(field: keyof PlanTaxAmounts, amount: number): void {
    this.amounts[field] = cents(this.amounts[field] + amount)
  }

  private assess(
    field:
      'ordinaryTaxCents' | 'capitalGainsTaxCents' | 'qualifiedDividendTaxCents',
    amount: number,
    accountId?: string,
  ): void {
    this.add(field, amount)
    this.add('taxAssessedCents', amount)
    if (accountId !== undefined) {
      const row = required(this.accountRows.get(accountId))
      row.taxAssessedCents = cents(row.taxAssessedCents + amount)
    }
  }

  private ordinary(amount: number, accountId?: string): void {
    this.add('ordinaryIncomeCents', amount)
    if (accountId !== undefined) {
      const row = required(this.accountRows.get(accountId))
      row.ordinaryIncomeCents = cents(row.ordinaryIncomeCents + amount)
    }
    this.assess(
      'ordinaryTaxCents',
      cents(amount * this.rates.ordinaryRate),
      accountId,
    )
  }

  deposit(accountId: string, amount: number): void {
    const basis = this.basis.get(accountId)
    if (basis !== undefined) this.basis.set(accountId, cents(basis + amount))
  }

  startAccount(account: AccountMonthlyRow): void {
    const id = account.accountId
    const metadata = required(this.metadata.get(id))
    this.deposit(id, account.externalContributionsCents)
    if (metadata.kind === 'savings')
      this.ordinary(Math.max(0, account.growthCents), id)
    const assumption = this.assumptions.accounts.find(
      (item) => item.accountId === id,
    )
    if (assumption) {
      const dividends = cents(
        account.openingBalanceCents * (assumption.annualDividendYield / 12),
      )
      const qualified = cents(dividends * assumption.qualifiedDividendShare)
      const ordinary = dividends - qualified
      this.deposit(id, dividends)
      const row = required(this.accountRows.get(id))
      row.qualifiedDividendsCents = qualified
      row.ordinaryDividendsCents = ordinary
      this.add('qualifiedDividendsCents', qualified)
      this.add('ordinaryDividendsCents', ordinary)
      this.ordinary(ordinary, id)
      this.assess(
        'qualifiedDividendTaxCents',
        cents(qualified * this.rates.qualifiedDividendRate),
        id,
      )
    }
    this.withdraw(
      id,
      account.scheduledWithdrawalsCents,
      cents(account.closingBalanceCents + account.scheduledWithdrawalsCents),
    )
  }

  private sale(accountId: string, amount: number, balance: number) {
    const basis = required(this.basis.get(accountId))
    const removed = removedBasis(basis, amount, balance)
    const gain = cents(amount - removed)
    return {
      basis: basis - removed,
      gain,
      tax: cents(Math.max(0, gain) * this.rates.capitalGainsRate),
    }
  }

  private withdrawalTax(
    accountId: string,
    amount: number,
    balance: number,
  ): number {
    const account = required(this.metadata.get(accountId))
    if (traditional(account)) return cents(amount * this.rates.ordinaryRate)
    if (account.kind === 'taxable')
      return this.sale(accountId, amount, balance).tax
    return 0
  }

  withdraw(
    accountId: string,
    amount: number,
    balance: number,
    destinationId?: string,
  ): void {
    if (amount === 0) return
    const account = required(this.metadata.get(accountId))
    if (traditional(account)) {
      const destination =
        destinationId === undefined
          ? undefined
          : this.metadata.get(destinationId)
      if (
        !destination ||
        !traditional(destination) ||
        account.owner !== destination.owner
      )
        this.ordinary(amount, accountId)
    } else if (account.kind === 'taxable') {
      const sale = this.sale(accountId, amount, balance)
      this.basis.set(accountId, sale.basis)
      this.add('capitalGainsCents', sale.gain)
      const row = required(this.accountRows.get(accountId))
      row.realizedGainsCents = cents(row.realizedGainsCents + sale.gain)
      this.assess('capitalGainsTaxCents', sale.tax, accountId)
    }
  }

  income(rows: readonly PlanIncomeRow[]): void {
    for (const row of rows) {
      const share = required(
        this.assumptions.incomes.find((item) => item.incomeId === row.incomeId),
      ).taxableShare
      this.ordinary(cents(row.amountCents * share))
    }
  }

  /**
   * Each account's net proceeds are monotone (rates are at most 100%).
   * Binary search finds the smallest whole-cent gross withdrawal in <=53 steps.
   * Full exhaustion is allowed even when a 100% rate yields no spendable cash.
   */
  fund(
    funds: number,
    spending: number,
    order: readonly string[],
    accounts: ReadonlyMap<string, AccountMonthlyRow>,
  ): { spending: number; surplus: number } {
    const due = () => cents(this.unpaid + this.amounts.taxAssessedCents)
    const withdraw = (id: string, amount: number) => {
      const account = required(accounts.get(id))
      const balance = account.closingBalanceCents
      this.withdraw(id, amount, balance)
      account.automaticWithdrawalsCents = cents(
        account.automaticWithdrawalsCents + amount,
      )
      account.closingBalanceCents -= amount
      funds = cents(funds + amount)
    }
    const fundNet = (gap: number, sources: readonly string[]) => {
      for (const id of sources) {
        if (gap <= 0) break
        const balance = required(accounts.get(id)).closingBalanceCents
        const net = (amount: number) =>
          amount - this.withdrawalTax(id, amount, balance)
        let amount = balance
        if (net(balance) >= gap) {
          let low = 0
          let high = balance
          while (low < high) {
            const mid = low + Math.floor((high - low) / 2)
            if (net(mid) >= gap) high = mid
            else low = mid + 1
          }
          amount = low
        }
        const proceeds = net(amount)
        withdraw(id, amount)
        gap -= proceeds
      }
      return gap
    }
    const paymentOrder = this.paymentOrder
    if (paymentOrder === null) {
      fundNet(cents(cents(due() + spending) - funds), order)
    } else {
      const fundTax = (gap: number) =>
        fundNet(fundNet(gap, paymentOrder), order)
      fundTax(Math.max(0, due() - funds))
      for (const id of order) {
        const gap = cents(cents(due() + spending) - funds)
        if (gap <= 0) break
        const before = due()
        withdraw(
          id,
          Math.min(gap, required(accounts.get(id)).closingBalanceCents),
        )
        // Tax-only accounts cover the new bill, never the remaining spending gap.
        fundTax(due() - before)
      }
    }
    this.amounts.taxPaidCents = Math.min(due(), funds)
    this.unpaid = due() - this.amounts.taxPaidCents
    this.amounts.unpaidTaxCents = this.unpaid
    const afterTax = funds - this.amounts.taxPaidCents
    const fundedSpending = Math.min(spending, afterTax)
    return { spending: fundedSpending, surplus: afterTax - fundedSpending }
  }

  endMonth(month: number, calendarMonth: string, phaseId: string): void {
    for (const row of this.accountRows.values())
      row.closingBasisCents = this.basis.get(row.accountId) ?? null
    this.monthly.push({
      ...this.amounts,
      month,
      calendarMonth,
      phaseId,
      accounts: [...this.accountRows.values()],
    })
  }

  result(): PlanTaxProjection {
    const annual = []
    for (let offset = 0; offset < this.monthly.length; offset += 12) {
      const rows = this.monthly.slice(offset, offset + 12)
      annual.push({
        ...summarize(rows),
        year: offset / 12 + 1,
        startMonth: required(rows[0]).month,
        endMonth: required(rows.at(-1)).month,
      })
    }
    return { monthly: this.monthly, annual, totals: summarize(this.monthly) }
  }
}
