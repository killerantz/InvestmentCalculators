import {
  Button,
  CheckboxField,
  ChoiceField,
  ComparisonChart,
  DataTable,
  Grid,
  Heading,
  Notice,
  NumberField,
  Panel,
  Row,
  SelectionControl,
  Stack,
  Tabs,
  Text,
  YearNavigator,
} from '@ui'
import type { GrowthPlannerModel } from '../model/useGrowthPlanner'

export function GrowthPlannerPage({ model }: { model: GrowthPlannerModel }) {
  return (
    <Stack>
      <Heading level={1}>Explore a possible path.</Heading>
      <Text muted>
        Compare two growth and cash-flow scenarios. These worksheets use one
        deterministic engine, monthly calculations, and annual summaries.
      </Text>
      <Notice>
        Returns and inflation are assumptions, not predictions. Monthly
        cent-rounding and simplified fee timing make the ledger understandable,
        but actual outcomes will differ. Taxes, life phases, and changing cash
        flows are not modeled yet.
      </Notice>
      <NumberField
        label="Projection length (months)"
        value={model.months}
        onChange={model.changeMonths}
        error={model.monthError}
        hint="Shared horizon for both scenarios: 0 to 1200 whole months. Years are projection years, not tax years."
      />
      <Grid>
        {model.scenarios.map((scenario) => (
          <Panel key={scenario.id} title={scenario.label} icon="calculator">
            {scenario.fields.map((field) => (
              <NumberField
                key={field.key}
                label={field.label}
                value={field.value}
                hint={field.hint}
                error={field.error}
                onChange={(value) =>
                  model.changeScenario(scenario.id, field.key, value)
                }
              />
            ))}
            {scenario.choices.map((field) => (
              <ChoiceField
                key={field.key}
                label={field.label}
                value={field.value}
                hint={field.hint}
                options={field.options}
                onChange={(value) =>
                  model.changeScenario(scenario.id, field.key, value)
                }
              />
            ))}
          </Panel>
        ))}
      </Grid>
      <Button appearance="primary" onClick={model.compare}>
        Compare scenarios
      </Button>
      <Notice tone={model.hasErrors ? 'error' : 'info'}>
        <Stack>
          <Text>{model.status}</Text>
          {model.errorMessages.map((message, index) => (
            <Text key={`${index}-${message}`}>{message}</Text>
          ))}
        </Stack>
      </Notice>
      {model.hasResults && (
        <Stack>
          <Heading level={2}>Outcomes, not a ranking</Heading>
          <DataTable
            caption="Scenario comparison"
            columns={model.summaryColumns}
            rows={model.summaryRows}
          />
          <Text muted>
            Differences are B minus A, not a total of the alternatives. Percent
            differences divide by A; N/A means A is zero or negative, or the
            measure is not monetary. An unsupported numeric difference is
            reported explicitly, also without a percentage. Higher is not always
            better, especially for fees and shortfalls. All money is nominal USD
            unless labeled otherwise.
          </Text>
          {model.chart && (
            <Panel title="Compare the paths" icon="calculator">
              <SelectionControl
                label="Chart measure"
                value={model.chartMetric}
                onChange={model.changeChartMetric}
                options={model.chartMetricOptions}
              />
              <SelectionControl
                label="Chart dollar basis"
                value={model.dollarBasis}
                onChange={model.changeDollarBasis}
                options={model.dollarBasisOptions}
              />
              <ComparisonChart
                title={model.chartTitle}
                xLabel="Projection month"
                yLabel={model.chartYLabel}
                series={model.chart.series}
                formatValue={model.formatChartValue}
              />
              <Text muted>
                Both paths cover the entire projection, including the starting
                point. Growth is cumulative on the chart, but per-period in the
                ledgers. Growth is before separately modeled fee deductions.
              </Text>
              <Text muted>
                Today&apos;s dollars express purchasing power at the start.
                Today&apos;s-dollar growth discounts each month&apos;s growth at
                month-end, then sums it. It is not a real rate of return or the
                change in purchasing power of the full balance.
              </Text>
              <Row>
                {model.inflationNotes.map((note) => (
                  <Text key={note} muted>
                    {note}
                  </Text>
                ))}
              </Row>
              <CheckboxField
                label="Show exact chart data"
                checked={model.showChartData}
                onChange={model.changeShowChartData}
              />
              {model.showChartData && (
                <DataTable
                  caption={`Chart data: ${model.chartTitle}`}
                  columns={model.chart.columns}
                  rows={model.chart.rows}
                />
              )}
            </Panel>
          )}
          <Heading level={2}>Inspect the ledgers</Heading>
          <Tabs
            label="Ledger interval"
            value={model.ledgerMode}
            onChange={model.changeLedgerMode}
            options={model.ledgerModeOptions}
          >
            <Stack>
              <Text muted>
                Nominal columns retain the original calculation units. Add
                detail columns to inspect cash flows and fees, or supplementary
                today&apos;s-dollar values. Shortfalls are unfunded withdrawals,
                not debt carried into later months.
              </Text>
              <Row>
                {model.visibilityOptions.map((option) => (
                  <CheckboxField
                    key={option.key}
                    label={option.label}
                    checked={option.checked}
                    onChange={(checked) =>
                      model.changeVisibility(option.key, checked)
                    }
                  />
                ))}
              </Row>
              {model.ledgerMode === 'monthly' && model.yearCount > 0 && (
                <YearNavigator
                  value={model.selectedYear}
                  max={model.yearCount}
                  onChange={model.changeYear}
                />
              )}
              {model.yearCount === 0 ? (
                <Text>
                  No periods to show: a zero-month projection contains only the
                  starting balance.
                </Text>
              ) : (
                model.ledgers.map((ledger) => (
                  <Panel
                    key={ledger.id}
                    title={`${ledger.label}: ${model.ledgerMode === 'annual' ? 'yearly ledger' : `monthly ledger, year ${model.selectedYear}`}`}
                    icon="boundaries"
                  >
                    <Text muted>{ledger.feeNote}</Text>
                    <DataTable
                      caption={`${ledger.label} ${model.ledgerMode === 'annual' ? 'annual summary' : `monthly ledger, year ${model.selectedYear}`}`}
                      columns={ledger.columns}
                      rows={ledger.rows}
                    />
                  </Panel>
                ))
              )}
            </Stack>
          </Tabs>
        </Stack>
      )}
    </Stack>
  )
}
