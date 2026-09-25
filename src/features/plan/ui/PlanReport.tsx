import {
  CheckboxField,
  ComparisonChart,
  DataTable,
  Notice,
  Panel,
  Row,
  SelectionControl,
  Stack,
  Tabs,
  Text,
  YearNavigator,
} from '@ui'
import type { PlanReportModel } from '../model/usePlanReport'

export function PlanReport({ model }: { model: PlanReportModel }) {
  return (
    <Stack>
      <Text emphasis>{model.planEndSummary}</Text>
      <Notice tone={model.hasShortfall ? 'error' : 'info'}>
        First unmet spending: {model.firstShortfall}. This is a deterministic
        scenario, not a probability of success. Unmet spending is not carried
        forward as debt.
      </Notice>
      <DataTable
        caption="Household projection totals (nominal unless labeled)"
        columns={['Measure', 'Amount']}
        rows={model.totals}
      />
      {model.taxReport ? (
        <Stack>
          <Notice tone={model.taxReport.hasUnpaid ? 'error' : 'info'}>
            Estimated taxes are enabled. Available income and scheduled
            withdrawals fund taxes first. Extra tax withdrawals use the tax
            order shown below, falling back to the spending withdrawal order,
            including tax on extra withdrawals. Ending unpaid tax:{' '}
            {model.taxReport.unpaid}. Unpaid taxes carry forward; account
            balances are not net of this remaining liability. No penalties or
            interest on unpaid tax are modeled.
          </Notice>
          <DataTable {...model.taxReport.summary} />
          <DataTable {...model.taxReport.funding} />
          <DataTable {...model.taxReport.accounts} />
          <Text muted>
            Brokerage dividends are assumed reinvested within the entered total
            return, not additional spendable income. Ordinary dividends are a
            subset of ordinary taxable income. Positive gains are taxed per
            sale; losses do not reduce tax. Account tax detail excludes taxes on
            pension and Social Security streams; household totals include them.
          </Text>
        </Stack>
      ) : (
        <Notice>
          Estimated taxes are off. Enable Tax assumptions to include their
          effect on spending and balances.
        </Notice>
      )}
      {model.hasTransferShortfall && (
        <Notice tone="error">
          Some account-to-account transfers could not be fully funded. Review
          the requested, moved, and unfilled amounts below. Unfilled amounts are
          not carried forward.
        </Notice>
      )}
      <DataTable
        caption="Account balances and depletion"
        columns={[
          'Account',
          'Starting balance ($)',
          'Final balance ($)',
          "Final balance (today's $)",
          'First zero closing balance',
          'Unfunded transfers to spending ($)',
        ]}
        rows={model.accountRows}
      />
      <DataTable
        caption="Money across phases (month-end balances)"
        columns={[
          'Phase',
          'First month',
          'Last month',
          'Opening ($)',
          'Closing ($)',
          "Closing (today's $)",
          'First unmet spending',
        ]}
        rows={model.phaseRows}
      />
      <Text>
        External savings are new money added from outside the modeled accounts,
        not account transfers or Roth conversions. Yearly ledger amounts are
        totals for that year; the phase totals below cover the entire phase.
      </Text>
      <DataTable
        caption="External savings by phase and account (new money only)"
        columns={[
          'Phase',
          'Account',
          'Monthly external savings ($)',
          'Setting source',
          'Entire phase savings ($)',
        ]}
        rows={model.contributionRows}
      />
      {model.transferRows.length > 0 && (
        <>
          <Text>
            Account-to-account transfers move existing funds without adding
            household income or savings. Roth conversion amounts are included in
            transfers, not added again. Estimated tax consequences are included
            only when Tax assumptions are enabled; withholding is not modeled.
            These totals cover each transfer&apos;s full selected phase range.
          </Text>
          <DataTable
            caption="Account transfers and Roth conversions by phase"
            columns={[
              'Transfer (priority order)',
              'Phase range',
              'Type',
              'From',
              'To',
              'Amount instruction',
              'Requested ($)',
              'Moved ($)',
              'Unfilled ($)',
            ]}
            rows={model.transferRows}
          />
        </>
      )}
      {model.percentageTransferRows.length > 0 && (
        <>
          <Text>
            Percentage transfers use calendar years, unlike the projection-year
            ledgers. The annual target uses the prior December 31 balance. Only
            one-twelfth is requested in each active month, with cent rounding
            adjustments and no catch-up. The active-month total can therefore be
            less than the annual target. This does not calculate IRS-required
            distributions. Estimated taxes, when enabled, are reported
            separately.
          </Text>
          <DataTable
            caption="Annual percentage transfer calculation details"
            columns={[
              'Transfer',
              'Phase range',
              'Calendar year',
              'Source account',
              'Reference date',
              'Reference source',
              'Reference balance ($)',
              'Annual percentage',
              'Full-year target ($)',
              'Active-month requests ($)',
              'Moved ($)',
              'Unfilled ($)',
            ]}
            rows={model.percentageTransferRows}
          />
        </>
      )}
      <Panel title="Balance and growth trends" icon="calculator">
        <Text emphasis>
          Starting balance across all accounts: {model.startingBalance}
        </Text>
        <Text>
          Household total is the sum of your accounts, not another account. Each
          named account has its own line. Use the checkboxes to show any
          combination; hiding a line does not change the household total.
        </Text>
        <Row>
          {model.seriesOptions.map((item) => (
            <CheckboxField
              key={item.id}
              label={item.label}
              checked={item.checked}
              onChange={(checked) => model.setSeriesVisible(item.id, checked)}
            />
          ))}
        </Row>
        <SelectionControl
          label="What to show (choose one)"
          value={model.metric}
          options={model.metricOptions}
          onChange={model.setMetric}
        />
        <Text>{model.metricDescription}</Text>
        <SelectionControl
          label="Dollar values (choose one)"
          value={model.basis}
          options={model.basisOptions}
          onChange={model.setBasis}
        />
        <Text>{model.basisDescription}</Text>
        <SelectionControl
          label="Time axis for both charts (choose one)"
          value={model.timeUnit}
          options={model.timeUnitOptions}
          onChange={model.setTimeUnit}
        />
        <Text muted>
          Years are measured from the plan start, not calendar years. Both views
          keep every monthly calculation point. These choices change the
          display, not your plan or its calculations.
        </Text>
        {model.series.length ? (
          <ComparisonChart
            title={model.chartTitle}
            xLabel={model.xLabel}
            yLabel={model.yLabel}
            series={model.series}
            formatValue={model.formatChartMoney}
            formatXValue={model.formatChartTime}
            markers={model.phaseMarkers}
            markerLabel="Phase starts"
          />
        ) : (
          <Notice>
            Select at least one chart line above to see balances or growth.
          </Notice>
        )}
      </Panel>
      <Panel title="Income and spending trends" icon="calculator">
        <ComparisonChart
          title={
            model.taxReport
              ? 'Monthly income, planned spending, and estimated taxes paid'
              : 'Monthly income versus planned spending'
          }
          xLabel={model.xLabel}
          yLabel="Nominal USD per month"
          series={model.flowSeries}
          formatValue={model.formatChartMoney}
          formatXValue={model.formatChartTime}
          markers={model.phaseMarkers}
          markerLabel="Phase starts"
        />
        <Text muted>
          Income here means Social Security and pension payments, not taxable
          income. Account withdrawals fund spending gaps when available; they
          are shown separately in the ledger. Optional estimated taxes include
          taxable account activity and Roth conversions; this chart shows tax
          paid, not outstanding bills. External savings are new money, not
          counted again as income.
        </Text>
      </Panel>
      <Tabs
        label="Projection ledger interval"
        value={model.interval}
        options={model.intervalOptions}
        onChange={model.setInterval}
      >
        <Stack>
          {model.taxReport && <DataTable {...model.taxReport.ledger} />}
          <Text muted>
            Ages show the start of each displayed period. Plan-end ages are
            shown in the summary above, including partial final years. Years run
            from the plan start, not necessarily January.
          </Text>
          <Text muted>
            Account transfers in and out cancel in household totals. Roth
            conversion columns are subsets of those transfers, not extra flows.
            Scheduled to spending refers to the separate spending pool.
          </Text>
          <CheckboxField
            label="Show today's-dollar growth and closing columns"
            checked={model.realColumns}
            onChange={model.setRealColumns}
          />
          {model.interval === 'monthly' && (
            <YearNavigator
              value={model.year}
              max={model.yearCount}
              onChange={model.setYear}
            />
          )}
          <DataTable
            caption="Household ledger: account transfers are not additional income or spending"
            columns={model.columns}
            rows={model.ledger}
          />
          {model.interval === 'monthly' && (
            <DataTable
              caption="Individual monthly income payments ($)"
              columns={model.incomeColumns}
              rows={model.incomeRows}
            />
          )}
          {model.accountLedgers.map((account) => (
            <DataTable
              key={account.id}
              caption={`${account.label}: ${model.interval} ledger`}
              columns={model.accountColumns}
              rows={account.rows}
            />
          ))}
        </Stack>
      </Tabs>
      <Text muted>
        Projection years group 12 months from the plan start, not tax years.
        Returns accrue monthly at equivalent rates; nominal compounding is not a
        bank credit schedule. Growth and fees are rounded to cents before
        end-month contributions, transfers, income, spending, automatic
        withdrawals, and surplus deposits. Engine: {model.version}.
      </Text>
    </Stack>
  )
}
