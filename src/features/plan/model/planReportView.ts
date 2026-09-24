import type { AccountMonthlyRow, PlanProjection } from '../../../domain/plan'
import { formatMoney } from '../../../shared/numbers'
import type { PlanDraft } from './draft'
import { formatAge, planAges } from './planAges'
import {
  transferAmountLabel,
  transferIncludesPhase,
  transferName,
  transferRangeLabel,
} from './transferPresentation'

export type ReportOptions = {
  interval: 'annual' | 'monthly'
  year: number
  hiddenSeries: readonly string[]
  timeUnit: 'years' | 'months'
  metric: 'closing' | 'growth'
  basis: 'nominal' | 'today'
  realColumns: boolean
}
const chartCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
export const formatChartMoney = (dollars: number) =>
  chartCurrency.format(dollars)

export function planReportView(
  projection: PlanProjection,
  draft: PlanDraft,
  options: ReportOptions,
) {
  const ages = planAges(projection.schedule)
  const accountName = (id: string) =>
    draft.accounts.find((account) => account.id === id)?.label ?? id
  const phaseName = (id: string) =>
    projection.schedule.phases.find((phase) => phase.id === id)?.label ?? id
  const chartX = (month: number) =>
    options.timeUnit === 'years' ? month / 12 : month
  const phaseMarkers = projection.schedule.phases.map((phase, index) => {
    const months = phase.startOffsetMonths
    const elapsed =
      options.timeUnit === 'years'
        ? `${Math.floor(months / 12)}y ${months % 12}m`
        : `${months} months`
    return {
      id: phase.id,
      x: chartX(months),
      label: `Phase ${index + 1}: ${phase.label}`,
      detail: `Starts ${phase.startMonth}; ${elapsed} from plan start; ${ages.describe(months)}. Applies to the following monthly period.`,
    }
  })
  const seriesOptions = [
    {
      id: 'household',
      label: 'Household total (all accounts)',
      accountId: null,
      openingBalanceCents: projection.totals.openingBalanceCents,
    },
    ...projection.accounts.map((account, index) => ({
      id: `account:${account.accountId}`,
      label: `Account ${index + 1}: ${accountName(account.accountId)}`,
      accountId: account.accountId,
      openingBalanceCents: account.openingBalanceCents,
    })),
  ]
  const series = seriesOptions.flatMap((item, styleIndex) => {
    if (options.hiddenSeries.includes(item.id)) return []
    let cumulativeGrowth = 0
    return [
      {
        id: item.id,
        label: item.label,
        styleIndex,
        points: [
          {
            x: 0,
            y: options.metric === 'growth' ? 0 : item.openingBalanceCents / 100,
          },
          ...projection.monthly.map((month) => {
            const row =
              item.accountId === null
                ? month
                : month.accounts.find(
                    (account) => account.accountId === item.accountId,
                  )
            if (!row)
              throw new Error(
                'Every projected month must contain every chart account.',
              )
            cumulativeGrowth +=
              options.basis === 'today' ? row.realGrowthCents : row.growthCents
            const balance =
              options.basis === 'today'
                ? row.realClosingBalanceCents
                : row.closingBalanceCents
            return {
              x: chartX(month.month),
              y:
                (options.metric === 'growth' ? cumulativeGrowth : balance) /
                100,
            }
          }),
        ],
      },
    ]
  })
  const rows =
    options.interval === 'annual'
      ? projection.annual
      : projection.monthly.filter(
          (row) =>
            row.month > (options.year - 1) * 12 &&
            row.month <= options.year * 12,
        )
  const amounts = [
    ['openingBalanceCents', 'Opening'],
    ['externalContributionsCents', 'External savings'],
    ['incomeCents', 'Social Security / pensions'],
    ['requestedSpendingCents', 'Planned spending'],
    ['spendingCents', 'Funded spending'],
    ['shortfallCents', 'Unmet spending'],
    ['growthCents', 'Growth'],
    ['feesCents', 'Fees'],
    ['scheduledWithdrawalsCents', 'Scheduled to spending'],
    ['scheduledWithdrawalShortfallCents', 'Unfunded spending-pool transfers'],
    ['transfersInCents', 'Account transfers in'],
    ['transfersOutCents', 'Account transfers out'],
    ['transferShortfallCents', 'Unfilled account transfers'],
    ['rothConversionsInCents', 'Of transfers in: Roth conversions'],
    ['rothConversionsOutCents', 'Of transfers out: Roth conversions'],
    ['automaticWithdrawalsCents', 'Automatic withdrawals'],
    ['surplusDepositsCents', 'Surplus deposits'],
    ['closingBalanceCents', 'Closing'],
    ...(options.realColumns
      ? [
          ['realGrowthCents', "Growth (today's $)"] as const,
          ['realClosingBalanceCents', "Closing (today's $)"] as const,
        ]
      : []),
  ] as const
  type AccountColumn = Extract<
    (typeof amounts)[number],
    readonly [keyof AccountMonthlyRow, string]
  >
  const accountAmounts = amounts.filter(
    (item): item is AccountColumn =>
      item[0] !== 'incomeCents' &&
      item[0] !== 'requestedSpendingCents' &&
      item[0] !== 'spendingCents' &&
      item[0] !== 'shortfallCents',
  )
  const period = (row: (typeof rows)[number]) =>
    'calendarMonth' in row
      ? row.calendarMonth
      : `Year ${row.year}${row.endMonth - row.startMonth + 1 < 12 ? ' (partial)' : ''}`
  const ageCells = (row: (typeof rows)[number]) => [
    ages.ledgerAge('calendarMonth' in row ? row.month - 1 : row.startMonth - 1),
  ]
  const event = (month: number | null) =>
    month === null
      ? 'None in this projection'
      : `${projection.monthly[month - 1]?.calendarMonth ?? ''} (${ages.describe(month)} at month end)`
  return {
    phaseMarkers,
    planEndSummary: ages.endSummary,
    version: projection.engineVersion,
    firstShortfall: event(projection.firstShortfallMonth),
    hasShortfall: projection.firstShortfallMonth !== null,
    hasTransferShortfall: projection.totals.transferShortfallCents > 0,
    totals: (
      [
        [
          'Starting balance (all accounts)',
          projection.totals.openingBalanceCents,
        ],
        ['Final balance', projection.totals.closingBalanceCents],
        [
          "Final balance (today's dollars)",
          projection.totals.realClosingBalanceCents,
        ],
        [
          'External savings added',
          projection.totals.externalContributionsCents,
        ],
        [
          'Social Security / pension income received',
          projection.totals.incomeCents,
        ],
        ['Spending funded', projection.totals.spendingCents],
        ['Unmet spending', projection.totals.shortfallCents],
        ['Growth earned before fees', projection.totals.growthCents],
        ['Fees', projection.totals.feesCents],
        [
          'Unfunded scheduled transfers to spending',
          projection.totals.scheduledWithdrawalShortfallCents,
        ],
        [
          'Account-to-account money moved (counted once)',
          projection.totals.transfersOutCents,
        ],
        [
          'Of money moved: Roth conversions (not taxable income)',
          projection.totals.rothConversionsOutCents,
        ],
        [
          'Unfilled account-to-account transfers',
          projection.totals.transferShortfallCents,
        ],
      ] as const
    ).map(([label, value]) => ({
      id: label,
      cells: [label, formatMoney(value)],
    })),
    seriesOptions: seriesOptions.map((item) => ({
      id: item.id,
      label: item.label,
      checked: !options.hiddenSeries.includes(item.id),
    })),
    accountRows: projection.accounts.map((account) => ({
      id: account.accountId,
      cells: [
        accountName(account.accountId),
        formatMoney(account.openingBalanceCents),
        formatMoney(account.closingBalanceCents),
        formatMoney(account.realClosingBalanceCents),
        event(account.firstDepletionMonth),
        formatMoney(account.scheduledWithdrawalShortfallCents),
      ],
    })),
    phaseRows: projection.schedule.phases.map((phase) => {
      const first = projection.monthly[phase.startOffsetMonths]
      const last = projection.monthly[phase.endOffsetMonths - 1]
      if (!first || !last)
        throw new Error('Every phase must have projected months.')
      const shortfall = projection.monthly
        .slice(phase.startOffsetMonths, phase.endOffsetMonths)
        .find((row) => row.shortfallCents > 0)
      return {
        id: phase.id,
        cells: [
          phase.label,
          first.calendarMonth,
          last.calendarMonth,
          formatMoney(first.openingBalanceCents),
          formatMoney(last.closingBalanceCents),
          formatMoney(last.realClosingBalanceCents),
          shortfall ? event(shortfall.month) : 'None',
        ],
      }
    }),
    contributionRows: projection.schedule.phases.flatMap((phase) => {
      const months = projection.monthly.slice(
        phase.startOffsetMonths,
        phase.endOffsetMonths,
      )
      return phase.accounts.map((account) => {
        const source = account.sources.monthlyContributionCents
        const total = months.reduce((sum, month) => {
          const row = month.accounts.find(
            (item) => item.accountId === account.accountId,
          )
          if (!row)
            throw new Error('Every phase month must contain every account.')
          return sum + row.externalContributionsCents
        }, 0)
        return {
          id: `${phase.id}:${account.accountId}`,
          cells: [
            phase.label,
            accountName(account.accountId),
            formatMoney(account.settings.monthlyContributionCents),
            source === null ? 'Account default' : phaseName(source),
            formatMoney(total),
          ],
        }
      })
    }),
    transferRows: (draft.finance?.transfers ?? []).map((transfer, index) => {
      let requested = 0
      let moved = 0
      let unfilled = 0
      for (const month of projection.monthly) {
        const entry = month.transfers.find(
          (item) => item.transferId === transfer.id,
        )
        if (!entry)
          throw new Error('Every projected month must contain every transfer.')
        requested += entry.requestedCents
        moved += entry.amountCents
        unfilled += entry.shortfallCents
      }
      return {
        id: transfer.id,
        cells: [
          transferName(transfer, index),
          transferRangeLabel(transfer, projection.schedule.phases),
          transfer.kind === 'roth-conversion'
            ? 'Roth conversion'
            : 'Account transfer',
          accountName(transfer.sourceAccountId),
          accountName(transfer.destinationAccountId),
          transferAmountLabel(transfer),
          formatMoney(requested),
          formatMoney(moved),
          formatMoney(unfilled),
        ],
      }
    }),
    percentageTransferRows: (draft.finance?.transfers ?? []).flatMap(
      (transfer, index) => {
        if (transfer.amountKind !== 'annual-percentage') return []
        const years = new Map<
          string,
          {
            reference: number
            annual: number
            requested: number
            moved: number
            unfilled: number
          }
        >()
        for (const month of projection.monthly) {
          if (
            !transferIncludesPhase(
              transfer,
              month.phaseId,
              projection.schedule.phases,
            )
          )
            continue
          const entry = month.transfers.find(
            (item) => item.transferId === transfer.id,
          )
          if (
            entry?.referenceBalanceCents === undefined ||
            entry.annualRequestedCents === undefined
          )
            throw new Error(
              'Active percentage transfers must include their annual calculation basis.',
            )
          const year = month.calendarMonth.slice(0, 4)
          const totals = years.get(year) ?? {
            reference: entry.referenceBalanceCents,
            annual: entry.annualRequestedCents,
            requested: 0,
            moved: 0,
            unfilled: 0,
          }
          totals.requested += entry.requestedCents
          totals.moved += entry.amountCents
          totals.unfilled += entry.shortfallCents
          years.set(year, totals)
        }
        return [...years].map(([year, totals]) => ({
          id: `${transfer.id}:${year}`,
          cells: [
            transferName(transfer, index),
            transferRangeLabel(transfer, projection.schedule.phases),
            year,
            accountName(transfer.sourceAccountId),
            `${Number(year) - 1}-12-31`,
            year === projection.monthly[0]?.calendarMonth.slice(0, 4)
              ? 'Entered prior year-end balance'
              : 'Projected December closing balance',
            formatMoney(totals.reference),
            `${transfer.annualPercentage}%`,
            formatMoney(totals.annual),
            formatMoney(totals.requested),
            formatMoney(totals.moved),
            formatMoney(totals.unfilled),
          ],
        }))
      },
    ),
    chartTitle:
      options.metric === 'closing'
        ? 'Account balances over time'
        : 'Growth earned so far',
    startingBalance: formatMoney(projection.totals.openingBalanceCents),
    metricDescription:
      options.metric === 'closing'
        ? 'Account balance is the money remaining after each month. The first point shows your starting funds; later points include growth, savings, fees, transfers and withdrawals.'
        : 'Growth earned so far adds up investment gains or losses since the plan started, before fees. It excludes starting funds and money added or withdrawn, so every line starts at zero.',
    basisDescription:
      options.basis === 'today'
        ? "Today's dollars express balances in planning-start purchasing power using your inflation assumption. For growth, each month's gain or loss is inflation-adjusted before it is added to the running total; this is not a real rate of return."
        : 'Nominal dollars are the projected dollar amounts at each date, without adjusting for inflation.',
    xLabel:
      options.timeUnit === 'years'
        ? 'Years since plan start'
        : 'Months since plan start',
    formatChartTime: (value: number) => {
      const months = Math.round(
        options.timeUnit === 'years' ? value * 12 : value,
      )
      return options.timeUnit === 'months'
        ? `${months}; ${ages.describe(months)}`
        : `${formatAge(months)}; ${ages.describe(months)}`
    },
    yLabel:
      options.basis === 'today'
        ? 'USD at planning-start purchasing power'
        : 'Nominal USD',
    series,
    flowSeries: [
      {
        id: 'income',
        label: 'Social Security / pensions',
        points: projection.monthly.map((row) => ({
          x: chartX(row.month),
          y: row.incomeCents / 100,
        })),
      },
      {
        id: 'spending',
        label: 'Planned spending',
        points: projection.monthly.map((row) => ({
          x: chartX(row.month),
          y: row.requestedSpendingCents / 100,
        })),
      },
    ],
    columns: [
      'Period',
      ...ages.columns,
      'Phase(s)',
      ...amounts.map(([, label]) => `${label} ($)`),
    ],
    ledger: rows.map((row) => ({
      id: period(row),
      cells: [
        period(row),
        ...ageCells(row),
        'phaseId' in row
          ? phaseName(row.phaseId)
          : [
              ...new Set(
                projection.monthly
                  .slice(row.startMonth - 1, row.endMonth)
                  .map((month) => phaseName(month.phaseId)),
              ),
            ].join(' / '),
        ...amounts.map(([key]) => formatMoney(row[key])),
      ],
    })),
    accountColumns: [
      'Period',
      ...ages.columns,
      ...accountAmounts.map(([, label]) => `${label} ($)`),
    ],
    accountLedgers: projection.accounts.map((account) => ({
      id: account.accountId,
      label: accountName(account.accountId),
      rows: rows.map((row) => {
        const amounts = row.accounts.find(
          (item) => item.accountId === account.accountId,
        )
        if (!amounts)
          throw new Error('Every ledger period must contain all accounts.')
        return {
          id: period(row),
          cells: [
            period(row),
            ...ageCells(row),
            ...accountAmounts.map(([key]) => formatMoney(amounts[key])),
          ],
        }
      }),
    })),
    incomeColumns: [
      'Month',
      ...(draft.finance?.incomes.map((income) => income.label) ?? []),
    ],
    incomeRows: projection.monthly
      .filter(
        (row) =>
          row.month > (options.year - 1) * 12 && row.month <= options.year * 12,
      )
      .map((row) => ({
        id: String(row.month),
        cells: [
          row.calendarMonth,
          ...(draft.finance?.incomes ?? []).map((income) => {
            const payment = row.incomes.find(
              (item) => item.incomeId === income.id,
            )
            return formatMoney(payment?.amountCents ?? 0)
          }),
        ],
      })),
  }
}
