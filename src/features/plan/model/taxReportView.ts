import type { PlanProjection } from '../../../domain/plan'
import type { DataTableProps } from '@ui'
import { formatMoney } from '../../../shared/numbers'
import type { PlanDraft } from './draft'
import type { ReportOptions } from './planReportView'
import { inheritedTaxPaymentOrder } from './taxDraft'
import { inheritedCashFlow } from './financeDraft'

export function taxReportView(
  projection: PlanProjection,
  draft: PlanDraft,
  options: ReportOptions,
) {
  const taxes = projection.taxes
  if (!taxes) return undefined
  const orderNames = (order: readonly string[]) =>
    order.length
      ? order
          .map(
            (id) =>
              draft.accounts.find((account) => account.id === id)?.label ?? id,
          )
          .join(' > ')
      : 'No accounts selected'
  const funding: DataTableProps = {
    caption: 'Tax payment order by phase',
    columns: [
      'Phase',
      'Extra tax withdrawals',
      'Spending order / tax fallback',
    ],
    rows: draft.phases.map((phase, index) => {
      const order = inheritedTaxPaymentOrder(draft, index + 1)
      return {
        id: phase.id,
        cells: [
          phase.label,
          order === null
            ? 'Follow spending withdrawal order'
            : orderNames(order),
          orderNames(inheritedCashFlow(draft, index + 1).withdrawalOrder),
        ],
      }
    }),
  }
  const rows =
    options.interval === 'annual'
      ? taxes.annual
      : taxes.monthly.filter(
          (row) =>
            row.month > (options.year - 1) * 12 &&
            row.month <= options.year * 12,
        )
  const metrics = [
    ['ordinaryIncomeCents', 'Ordinary taxable income'],
    ['ordinaryDividendsCents', 'Of ordinary income: dividends'],
    ['qualifiedDividendsCents', 'Qualified dividends'],
    ['capitalGainsCents', 'Realized gains / losses'],
    ['ordinaryTaxCents', 'Ordinary-income tax'],
    ['qualifiedDividendTaxCents', 'Qualified-dividend tax'],
    ['capitalGainsTaxCents', 'Realized-gain tax'],
    ['taxAssessedCents', 'Total tax assessed'],
    ['taxPaidCents', 'Tax paid from household funds'],
    ['unpaidTaxCents', 'Unpaid tax (closing liability)'],
  ] as const
  const help: Record<(typeof metrics)[number][0], string> = {
    ordinaryIncomeCents:
      'Income subject to your ordinary rate: traditional retirement withdrawals and conversions, savings interest, ordinary dividends, and the entered taxable share of pension and Social Security payments. Ordinary dividends are already included here.',
    ordinaryDividendsCents:
      'The non-qualified portion of estimated brokerage dividends. This is a subset of ordinary taxable income, not additional income to add to that row.',
    qualifiedDividendsCents:
      'Estimated dividends multiplied by your entered qualified share. These use the qualified-dividend rate and are assumed reinvested within your account return.',
    capitalGainsCents:
      'Sale proceeds minus the proportional pooled basis removed from brokerage holdings. This audit total includes losses, but the model taxes positive gains per sale without offsetting them with losses.',
    ordinaryTaxCents:
      'Estimated tax on ordinary taxable income, using the rate active in each phase.',
    capitalGainsTaxCents:
      'Estimated tax on positive realized brokerage gains. Unsold gains are not taxed, and losses receive no credit.',
    qualifiedDividendTaxCents:
      'Estimated tax on qualified dividends, using the rate active in each phase.',
    taxAssessedCents:
      'New estimated tax bills generated across the plan. This can exceed taxes paid when your allowed funding accounts run out.',
    taxPaidCents:
      'Money used to pay estimated tax bills. Paid taxes have already reduced account balances and are not subtracted from them again.',
    unpaidTaxCents:
      'The remaining tax bill at the end of the plan, not the sum of monthly outstanding bills. It is carried forward without interest or penalties and has not yet reduced account balances.',
  }
  const summary: DataTableProps = {
    caption: 'Estimated tax totals (nominal dollars)',
    columns: ['Measure', 'Amount'],
    rows: [
      ...metrics.map(([key, label]) => ({
        id: key,
        cells: [label, formatMoney(taxes.totals[key])],
        help: help[key],
      })),
      {
        id: 'netAssets',
        cells: [
          'Final account balances minus unpaid taxes',
          formatMoney(
            projection.totals.closingBalanceCents - taxes.totals.unpaidTaxCents,
          ),
        ],
        help: 'Account balances already reflect taxes paid. Subtract any remaining tax bill to estimate net assets. This does not deduct potential taxes on selling all remaining investments.',
      },
    ],
  }
  const ledger: DataTableProps = {
    caption: 'Estimated tax ledger (nominal dollars; projection years)',
    columns: ['Period', ...metrics.map(([, label]) => `${label} ($)`)],
    rows: rows.map((row) => {
      const period =
        'calendarMonth' in row
          ? row.calendarMonth
          : `Year ${row.year}${row.endMonth - row.startMonth + 1 < 12 ? ' (partial)' : ''}`
      return {
        id: period,
        cells: [period, ...metrics.map(([key]) => formatMoney(row[key]))],
      }
    }),
  }
  const first = taxes.monthly[0]
  const last = taxes.monthly.at(-1)
  const accounts: DataTableProps = {
    caption: 'Account tax detail across the full plan',
    columns: [
      'Account',
      'Starting pooled basis ($)',
      'Ending pooled basis ($)',
      'Realized gains / losses ($)',
      'Ordinary taxable income ($)',
      'Qualified dividends ($)',
      'Tax assessed ($)',
    ],
    rows: (first?.accounts ?? []).map((opening) => {
      const closing = last?.accounts.find(
        (account) => account.accountId === opening.accountId,
      )
      if (!closing)
        throw new Error('Every tax account must have a closing row.')
      const accountRows = taxes.monthly.map((month) => {
        const row = month.accounts.find(
          (account) => account.accountId === opening.accountId,
        )
        if (!row) throw new Error('Every tax month must include every account.')
        return row
      })
      const total = (
        key:
          | 'realizedGainsCents'
          | 'ordinaryIncomeCents'
          | 'qualifiedDividendsCents'
          | 'taxAssessedCents',
      ) => formatMoney(accountRows.reduce((sum, row) => sum + row[key], 0))
      return {
        id: opening.accountId,
        cells: [
          draft.accounts.find((account) => account.id === opening.accountId)
            ?.label ?? opening.accountId,
          opening.openingBasisCents === null
            ? 'Not applicable'
            : formatMoney(opening.openingBasisCents),
          closing.closingBasisCents === null
            ? 'Not applicable'
            : formatMoney(closing.closingBasisCents),
          total('realizedGainsCents'),
          total('ordinaryIncomeCents'),
          total('qualifiedDividendsCents'),
          total('taxAssessedCents'),
        ],
      }
    }),
  }
  return {
    funding,
    summary,
    ledger,
    accounts,
    hasUnpaid: taxes.totals.unpaidTaxCents > 0,
    unpaid: formatMoney(taxes.totals.unpaidTaxCents),
    cashFlowColumns: ['Tax paid ($)', 'Unpaid tax at period end ($)'],
    cashFlowCells: rows.map((row) => [
      formatMoney(row.taxPaidCents),
      formatMoney(row.unpaidTaxCents),
    ]),
  }
}
