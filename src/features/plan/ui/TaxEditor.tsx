import { CheckboxField, Notice, Panel, Stack, Text } from '@ui'
import type { TaxEditorModel } from '../model/taxEditor'
import { Fields } from './Fields'
import { WithdrawalOrder } from './WithdrawalOrder'

export function TaxEditor({ model }: { model: TaxEditorModel }) {
  return (
    <Stack>
      <CheckboxField
        label="Include estimated taxes in this plan"
        checked={model.enabled}
        onChange={model.toggle}
      />
      {!model.enabled ? (
        <Notice>
          Taxes are off. Projections use the original cash-flow rules. Enable
          this optional layer to estimate taxes and choose how to fund them.
          Turning it off preserves your tax drafts.
        </Notice>
      ) : (
        <>
          <Notice>
            Planning estimates, not a tax return. Taxes are paid before
            spending. Automatic withdrawals include extra funds to cover their
            own estimated tax. A separate tax order can be selected below, with
            the spending withdrawal order as fallback. Unpaid tax carries
            forward and is reported separately. No brackets, deductions,
            credits, penalties, state rules, tax-loss offsets, or payment
            deadlines are calculated.
          </Notice>
          {model.hasAggregate && (
            <Notice tone="error">
              A combined portfolio has no single tax treatment. Use individual
              account types before calculating with taxes enabled, or turn taxes
              off.
            </Notice>
          )}
          <Panel title="Initial estimated tax rates" icon="calculator">
            <Text>
              Enter all three rates, including an explicit 0 when applicable.
              Phase overrides below can change these later.
            </Text>
            <Fields fields={model.fields} />
          </Panel>
          <Panel title="Tax payment funding" icon="calculator">
            <Text>
              Available income and scheduled withdrawals cover taxes first. By
              default, extra tax withdrawals follow the spending withdrawal
              order in each phase. Choose a separate order to use savings,
              brokerage, or other accounts for taxes without changing spending
              distributions.
            </Text>
            <CheckboxField
              label="Use a separate tax-payment order"
              checked={model.separateOrder}
              onChange={model.toggleSeparateOrder}
            />
            {model.separateOrder && <WithdrawalOrder model={model.order} />}
            <Text muted>
              If these accounts cannot cover the tax bill, the planner falls
              back to that phase&apos;s spending withdrawal order. Extra tax
              withdrawals include their own estimated taxes. Accounts selected
              only for taxes do not fund spending shortfalls. Unpaid tax is
              reported if both orders run out.
            </Text>
          </Panel>
          <Panel title="Account treatment assumptions" icon="components">
            <Text>
              Traditional IRAs and workplace plans: gross withdrawals and Roth
              conversions are fully ordinary taxable income; after-tax
              retirement basis is not modeled. Same-owner
              traditional-to-traditional transfers are assumed tax-free
              rollovers.
            </Text>
            <Text>
              Roth accounts: withdrawals are assumed qualified and tax-free. The
              planner does not check age, holding periods, or eligibility.
            </Text>
            <Text>
              Savings: positive interest is ordinary taxable income; withdrawing
              principal is not income.
            </Text>
            <Text>
              Brokerage: leaving the account is modeled as selling investments.
              Only positive realized gains are taxed. Losses receive no credit.
              The account&apos;s existing return is TOTAL return, including
              reinvested dividends; dividend details do not add growth again.
              This differs from the price-only growth field in Portfolio &amp;
              taxes.
            </Text>
            <Text>
              External savings are already-budgeted contributions. Contribution
              deductions and employment income are not calculated. Starting cost
              basis and income taxable shares are assumptions, not eligibility
              determinations.
            </Text>
          </Panel>
          {model.accounts.map((account) => (
            <Panel
              key={account.id}
              title={`${account.label}: brokerage tax details`}
              icon="calculator"
            >
              <Fields fields={account.fields} />
            </Panel>
          ))}
          {model.incomes.map((income) => (
            <Panel
              key={income.id}
              title={`${income.label}: income tax details`}
              icon="calculator"
            >
              <Fields fields={income.fields} />
            </Panel>
          ))}
          <Text>
            Optional phase changes: leave rates inherited unless you expect a
            different tax rate or payment order. Overrides carry forward until
            replaced, including an explicit zero rate.
          </Text>
          {model.phases.map((phase) => (
            <Panel
              key={phase.id}
              title={`${phase.label}: optional tax changes`}
              icon="calculator"
            >
              <Text muted>{phase.orderInherited}</Text>
              <Fields fields={phase.orderFields} />
              {phase.order && <WithdrawalOrder model={phase.order} />}
              {phase.rates.map((rate) => (
                <Stack key={rate.id}>
                  <Text muted>{rate.inherited}</Text>
                  <CheckboxField
                    label={rate.label}
                    checked={rate.enabled}
                    onChange={rate.toggle}
                  />
                  {rate.enabled && <Fields fields={rate.fields} />}
                </Stack>
              ))}
            </Panel>
          ))}
        </>
      )}
    </Stack>
  )
}
