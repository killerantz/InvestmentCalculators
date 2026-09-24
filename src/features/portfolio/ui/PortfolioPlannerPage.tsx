import {
  Button,
  ChoiceField,
  ComparisonChart,
  DataTable,
  Grid,
  Heading,
  Notice,
  NumberField,
  Panel,
  Stack,
  Text,
  TextField,
} from '@ui'
import type {
  FieldView,
  PortfolioPlannerModel,
} from '../model/usePortfolioPlanner'

function Fields({ fields }: { fields: readonly FieldView[] }) {
  return (
    <Grid>
      {fields.map(({ key, text, ...field }) =>
        field.options ? (
          <ChoiceField key={key} {...field} options={field.options} />
        ) : text ? (
          <TextField key={key} {...field} />
        ) : (
          <NumberField key={key} {...field} />
        ),
      )}
    </Grid>
  )
}

export function PortfolioPlannerPage({
  model,
}: {
  model: PortfolioPlannerModel
}) {
  return (
    <Stack>
      <Heading level={1}>Portfolio &amp; estimated taxes</Heading>
      <Text muted>
        A standalone taxable-brokerage worksheet. Multiple accounts are actual
        holdings and are added together, never alternative scenarios. The
        starting example is synthetic, not investment or tax advice. No
        retirement-plan integration.
      </Text>
      <Notice>
        Enter your own estimated tax rates (0–100%). This is NOT a household tax
        return: no cross-account gain/loss netting, tax brackets, deductions,
        credits, state-specific rules, withholding, or payment deadlines. One
        realized-gain rate; no short/long-term split. Pooled basis per asset,
        not tax lots. Losses offset gains only in the same account and calendar
        year; no carryforward or ordinary-income deduction. Only projected
        activity counts: pre-start year-to-date gains/losses and existing unpaid
        taxes are not inputs, even when starting midyear.
      </Notice>
      <Panel title="Projection and entered tax rates" icon="calculator">
        <Text muted>
          Use 1–1200 total months. Calendar years must stay within 0001–9999.
        </Text>
        <Fields fields={model.fields} />
      </Panel>
      <Panel title="Timing and cash rules" icon="calculator">
        <Text>
          Each month: apply effective monthly price growth; pay distributions at
          annual yield ÷ 12 on post-growth market value; add external cash;
          assess distribution tax and pay outstanding tax from available cash;
          plan any rebalance sales from pretrade invested weights; execute those
          sales; settle net realized-gain tax in December and the final month;
          pay outstanding tax; then buy or reinvest.
        </Text>
        <Text>
          Price growth excludes dividends and interest: do not enter total
          return. Distributions are additional cash, not deducted from modeled
          price. Between rebalances, reinvest only remaining after-tax
          distributions into their originating assets, or hold distributions in
          cash until the next rebalance. Starting cash and external contribution
          cash deploy only at a rebalance. At a rebalance, ALL remaining cash
          (including retained distributions) funds target deficits. With no
          rebalancing, contributions and held distributions remain cash. Cash
          can pay tax but is not automatically routed to spending or the
          life-phase planner.
        </Text>
        <Text>
          Targets must total 100% of the invested asset sleeve, excluding cash.
          Initial holdings need not match targets. Threshold drift is the
          absolute difference in percentage points, checked monthly before
          trades. December is the annual rebalance month, not the start
          anniversary. Taxes may leave weights off target; there are never extra
          sales solely to pay tax.
        </Text>
        <Text>
          Unpaid tax remains a liability and future cash pays it before
          purchases. Ending equity = gross assets (investments + cash) − unpaid
          assessed tax. Equity is NOT an after-liquidation value:
          unrealized-gain taxes are not deducted. A final non-December month
          receives a partial-year gain-tax settlement. Distributions and each
          asset&apos;s distribution-tax categories round separately to cents.
          Cash earns no interest. Price growth must be greater than −100% and at
          most 10,000%; yield 0–1,000%.
        </Text>
      </Panel>
      {model.accounts.map((account) => (
        <Panel key={account.id} title={account.title} icon="calculator">
          <Fields fields={account.fields} />
          {account.allocationError && (
            <Notice tone="error">{account.allocationError}</Notice>
          )}
          {account.assets.map((asset) => (
            <Panel key={asset.id} title={asset.title} icon="calculator">
              <Fields fields={asset.fields} />
              <Button onClick={asset.remove}>Remove asset</Button>
            </Panel>
          ))}
          <Button onClick={account.addAsset}>Add asset</Button>
          <Button onClick={account.remove}>Remove account</Button>
        </Panel>
      ))}
      <Button onClick={model.addAccount}>Add brokerage account</Button>
      <Button appearance="primary" onClick={model.calculate}>
        Calculate portfolio &amp; taxes
      </Button>
      <Notice tone={model.errors.length ? 'error' : 'info'}>
        <Stack>
          <Text>{model.status}</Text>
          {model.errors.map((error, index) => (
            <Text key={index}>{error}</Text>
          ))}
        </Stack>
      </Notice>
      {model.report && (
        <Stack>
          <Heading level={2}>Holdings and estimated tax outcomes</Heading>
          <DataTable {...model.report.summary} />
          <ComparisonChart {...model.report.chart} />
          <Text muted>
            Gross assets and equity overlap when all assessed taxes are paid;
            both already reflect cash paid for tax. Sales turnover is gross sale
            proceeds, not a return or an additional expense.
          </Text>
          <ChoiceField
            label="Inspect account or totals"
            value={model.report.selectedAccount}
            options={model.report.accountOptions}
            onChange={model.selectAccount}
          />
          <DataTable {...model.report.annual} />
          <ChoiceField
            label="Inspect calendar year"
            value={model.report.selectedYear}
            options={model.report.yearOptions}
            onChange={model.selectYear}
          />
          <DataTable {...model.report.monthly} />
          <DataTable {...model.report.assets} />
          <DataTable {...model.report.events} />
        </Stack>
      )}
    </Stack>
  )
}
