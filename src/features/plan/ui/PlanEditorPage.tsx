import {
  Button,
  CheckboxField,
  ChoiceField,
  ConfirmDialog,
  DataTable,
  Heading,
  Notice,
  Panel,
  Row,
  ScheduleTimeline,
  Stack,
  Tabs,
  Text,
} from '@ui'
import type { PlanEditorModel } from '../model/usePlanEditor'
import { Fields } from './Fields'
import { WithdrawalOrder } from './WithdrawalOrder'
import { PlanReport } from './PlanReport'
import { TaxEditor } from './TaxEditor'

export function PlanEditorPage({ model }: { model: PlanEditorModel }) {
  return (
    <Stack>
      <Heading level={1}>Life-phase plan</Heading>
      <Text>
        Define the household clock, accounts, and changes over time. Settings
        carry forward until a later phase overrides them.
      </Text>
      <Notice>
        <Text emphasis>Deterministic assumptions, not financial advice</Text>
        Synthetic starting examples only. Edits and copies stay in memory and
        are lost on reload. Estimated taxes are optional in Tax assumptions.
        Projections do not determine tax or benefit eligibility, account-access
        restrictions, contribution limits, Medicare, or IRS-required RMD
        amounts. You choose which accounts may fund each phase. Phase names do
        not activate rules.
      </Notice>
      <Row align="end">
        <ChoiceField
          label="Active plan"
          value={model.selected}
          options={model.planOptions}
          onChange={model.selectPlan}
        />
        <Button onClick={model.duplicate}>Duplicate plan</Button>
      </Row>
      <ConfirmDialog
        open={model.pendingRemoval !== null}
        title={`Remove ${model.pendingRemoval?.label ?? ''}?`}
        onConfirm={model.confirmRemoval}
        onCancel={model.cancelRemoval}
      >
        {model.pendingRemoval?.kind === 'account'
          ? 'This removes the account, its phase overrides, withdrawal-order entries, and transfers to or from it. If it receives surplus, choose a new destination. Other plan copies are unchanged.'
          : model.pendingRemoval?.kind === 'income'
            ? 'This removes this income stream from the current plan. Other plan copies are unchanged.'
            : model.pendingRemoval?.kind === 'transfer'
              ? 'This removes this scheduled transfer from the current plan. Other plan copies are unchanged.'
              : 'This removes the phase, its overrides, and transfers that start or end in it. Transfers spanning across it keep their remaining range. Later phases inherit settings from the remaining earlier phases.'}
      </ConfirmDialog>
      <Notice
        tone="error"
        hidden={model.issueGroups.length === 0}
        focusRequest={model.validationRequest}
      >
        <Stack>
          <Text emphasis>Correct these issues before previewing</Text>
          {model.issueGroups.map((group) => (
            <Stack key={group.value}>
              <Button onClick={group.go}>Review {group.label}</Button>
              {group.issues.map((message, index) => (
                <Text key={index}>{message}</Text>
              ))}
            </Stack>
          ))}
        </Stack>
      </Notice>
      <Tabs
        label="Plan editor sections"
        value={model.tab}
        onChange={model.setTab}
        options={model.sections}
        showNext
      >
        {model.tab === 'taxes' && <TaxEditor model={model.taxes} />}
        {model.tab === 'household' && (
          <Panel title="Household and planning horizon" icon="components">
            <Fields fields={model.householdFields} />
            <CheckboxField
              label="Include a partner"
              checked={model.partnerEnabled}
              onChange={model.setPartnerEnabled}
            />
            {model.planEndSummary && (
              <Text emphasis>{model.planEndSummary}</Text>
            )}
            <Text muted>
              Ages are measured at the planning start, without birth dates.
              Turning off a partner retains their age draft; partner-owned
              accounts and age anchors must be changed before validation can
              succeed.
            </Text>
          </Panel>
        )}
        {model.tab === 'accounts' && (
          <Stack>
            <Text>
              Use one combined portfolio for a simple plan, or list individual
              accounts. A combined portfolio must be the only account. Existing
              drafts are never automatically merged or discarded.
            </Text>
            <Notice>
              Traditional workplace plan (401k) means an employer-sponsored
              retirement account; Roth 401k is its Roth counterpart. Account
              types provide tax treatment only when optional tax assumptions are
              enabled; labels do not determine eligibility. Social Security and
              pensions are income streams, not accounts. Separate income entry
              is on Income &amp; spending.
            </Notice>
            <Notice>
              Contributions are additional savings already budgeted outside this
              model, such as money from your paycheck. Do not enter the same
              money again as an income stream. They add new money; they do not
              move money from another account. Use Transfers &amp; conversions
              to move existing funds. Scheduled withdrawals transfer money into
              the spending pool; they are not extra spending. Unused funds
              return to your chosen surplus account.
            </Notice>
            <Text>
              Percentage distributions that start in later calendar years use
              calculated December balances automatically. No historical balance
              entry is needed when you start the plan before those
              distributions. A dated historical-balance field appears only for a
              first-year percentage source, or to let you review a previously
              entered value.
            </Text>
            {model.accounts.map((account) => (
              <Panel key={account.id} title={account.label} icon="calculator">
                <Fields fields={account.fields} />
                <Button disabled={!account.canRemove} onClick={account.remove}>
                  Remove account
                </Button>
              </Panel>
            ))}
            <Button onClick={model.addAccount}>Add account</Button>
          </Stack>
        )}
        {model.tab === 'income' && (
          <Stack>
            <Panel title="Spending and surplus" icon="calculator">
              <Fields fields={model.finances.fields} />
              <Text muted>
                Income and scheduled withdrawals fund household needs. If taxes
                are enabled, estimated taxes are paid before spending. A gap
                draws from the order below; unused funds go to the selected
                account. Growth and fees occur before end-of-month cash flows.
              </Text>
              <Heading level={3}>Initial automatic withdrawal order</Heading>
              <Text muted>
                Check accounts to include, then move them into order. Phases can
                override this list, including excluding retirement accounts
                during a bridge.
              </Text>
              <WithdrawalOrder model={model.finances.order} />
            </Panel>
            <Notice>
              Enter each person&apos;s Social Security and pensions separately.
              Amounts are nominal monthly payments at their own start ages.
              Assumed increases begin after 12 payment months, then repeat on
              each start anniversary. Payments continue through the plan; no
              survivor changes are modeled. Taxable payment shares are entered
              separately when estimated taxes are enabled.
            </Notice>
            {model.finances.incomes.length === 0 && (
              <Text>
                No income streams yet. An accumulation-only plan can leave this
                empty.
              </Text>
            )}
            {model.finances.incomes.map((income) => (
              <Panel key={income.id} title={income.label} icon="calculator">
                <Fields fields={income.fields} />
                <Button onClick={income.remove}>Remove income</Button>
              </Panel>
            ))}
            <Button onClick={model.addIncome}>Add income stream</Button>
          </Stack>
        )}
        {model.tab === 'transfers' && (
          <Stack>
            <Notice>
              Name each transfer, then choose its starting and ending phases. It
              runs through the end of the ending phase. Indefinitely means
              through the end of the plan; starting in the last phase disables
              the ending selector. Existing single-phase entries keep their
              duration until you change it. Separate entries run independently:
              adding a new amount does not replace an earlier transfer.
            </Notice>
            <Text>
              Choose fixed monthly dollars or an annual percentage. Percentage
              transfers use the source account&apos;s previous December 31
              balance, recalculate each January, and pay one-twelfth in each
              active month. Partial-year phases do not catch up missed payments.
              Monthly amounts may differ by a cent to reconcile rounding.
            </Text>
            <Text>
              For percentage transfers active in the plan&apos;s first calendar
              year only, enter the source account&apos;s dated historical
              balance on Accounts: that December is outside the projection. If
              the plan starts before distributions, leave historical balances
              blank. Later years always use calculated December closing
              balances. This is an RMD-style simulation using your percentage,
              not an IRS divisor calculation or a check of RMD compliance. Use
              an account-to-account transfer, not a Roth conversion, to simulate
              distributing money to a cash or taxable account.
            </Text>
            <Text>
              Roth conversions move funds from a traditional IRA or 401k to a
              Roth IRA or 401k owned by the same person. Optional Tax
              assumptions estimate ordinary-income tax on conversions and
              account-specific taxes on transfers. Eligibility, withholding, and
              penalties are not calculated.
            </Text>
            <Text>
              Transfers run in the order below after growth, fees, external
              savings, and scheduled withdrawals to spending, but before
              automatic tax/spending-gap withdrawals. Earlier transfers can use
              up funds needed later; received funds are available to later
              transfers that month. If funds run short, the available amount
              moves and the unfilled amount is reported, not carried forward.
            </Text>
            <Text>
              Use these transfers for conversions and account-to-account
              payouts. Phases still set spending and automatic withdrawal order.
              Do not enter the same payout again as a scheduled transfer to
              spending on Accounts or Phases; both instructions would execute.
            </Text>
            {model.transfers.length === 0 && (
              <Text>No account-to-account transfers yet.</Text>
            )}
            {model.transfers.map((transfer) => (
              <Panel key={transfer.id} title={transfer.label} icon="calculator">
                <Fields fields={transfer.fields} />
                <Row>
                  <Button
                    disabled={!transfer.canMoveEarlier}
                    onClick={transfer.earlier}
                  >
                    Move {transfer.label} earlier
                  </Button>
                  <Button
                    disabled={!transfer.canMoveLater}
                    onClick={transfer.later}
                  >
                    Move {transfer.label} later
                  </Button>
                  <Button onClick={transfer.remove}>
                    Remove {transfer.label}
                  </Button>
                </Row>
              </Panel>
            ))}
            <Button onClick={model.addTransfer}>
              Add transfer or conversion
            </Button>
          </Stack>
        )}
        {model.tab === 'phases' && (
          <Stack>
            <Text>
              Phases must be entered in increasing age order within the planning
              horizon. Use years and additional months, for example 59 years and
              6 months. No eligibility is inferred from that age.
            </Text>
            <Notice>
              External savings add new money to an account, not a transfer or
              Roth conversion from another account. To stop savings in a phase,
              keep its contribution override checked and enter 0 for each
              account. Unchecking carries forward the previous amount.
            </Notice>
            {model.phases.map((phase) => (
              <Panel key={phase.id} title={phase.label} icon="components">
                <Text muted>{phase.boundary}</Text>
                <Fields fields={phase.fields} />
                {phase.first && (
                  <Text>The first phase begins at the planning start.</Text>
                )}
                <Heading level={3}>
                  Spending and account access assumptions
                </Heading>
                <CheckboxField
                  label="Override monthly spending"
                  checked={phase.cashFlow.spendingEnabled}
                  onChange={phase.cashFlow.spendingToggle}
                />
                {phase.cashFlow.spendingEnabled ? (
                  <Fields fields={phase.cashFlow.fields} />
                ) : (
                  <Text muted>{phase.cashFlow.spendingInherited}</Text>
                )}
                <CheckboxField
                  label="Override automatic withdrawal order"
                  checked={phase.cashFlow.orderEnabled}
                  onChange={phase.cashFlow.orderToggle}
                />
                {phase.cashFlow.orderEnabled ? (
                  <WithdrawalOrder model={phase.cashFlow.order} />
                ) : (
                  <Text muted>{phase.cashFlow.orderInherited}</Text>
                )}
                <Text muted>
                  Excluding an account only stops automatic withdrawals. Set its
                  scheduled transfer to 0 as well if you do not want withdrawals
                  from it.
                </Text>
                {phase.accounts.map((account) => (
                  <Stack key={account.id}>
                    <Heading level={3}>{account.label}</Heading>
                    {account.settings.map((setting) => (
                      <Stack key={setting.id}>
                        <CheckboxField
                          label={setting.label}
                          checked={setting.enabled}
                          onChange={setting.toggle}
                        />
                        {setting.enabled ? (
                          <Fields fields={setting.fields} />
                        ) : (
                          <Text muted>{setting.inherited}</Text>
                        )}
                      </Stack>
                    ))}
                    <CheckboxField
                      label="Override rate assumption"
                      checked={account.rate.enabled}
                      onChange={account.rate.toggle}
                    />
                    {account.rate.enabled ? (
                      <Fields fields={account.rate.fields} />
                    ) : (
                      <Text muted>{account.rate.inherited}</Text>
                    )}
                  </Stack>
                ))}
                <Text muted>
                  Uncheck an override to inherit again. Enter 0 as an explicit
                  change to zero. The validated preview identifies the source
                  phase for every setting.
                </Text>
                {!phase.first && (
                  <Button onClick={phase.remove}>Remove phase</Button>
                )}
              </Panel>
            ))}
            <Button onClick={model.addPhase}>Add phase</Button>
          </Stack>
        )}
        {model.tab === 'report' && (
          <Stack>
            <Button appearance="primary" onClick={model.project}>
              Calculate projection
            </Button>
            {model.report ? (
              <PlanReport model={model.report} />
            ) : (
              <Notice>
                Calculate this draft to see money over time. Changes clear all
                previous results; validation issues identify the sections to
                review.
              </Notice>
            )}
          </Stack>
        )}
        {model.tab === 'preview' && (
          <Stack>
            <Row>
              <Button appearance="primary" onClick={model.preview}>
                Validate and preview schedule
              </Button>
            </Row>
            {!model.result && model.issueGroups.length === 0 && (
              <Notice>
                <Text emphasis>Preview needs validation</Text>Validate this
                draft to see its schedule. Any edit clears the previous preview
                so stale instructions are not displayed.
              </Notice>
            )}
            {model.result && (
              <Stack>
                <Panel title="Household timeline" icon="components">
                  <Text emphasis>{model.result.planEndSummary}</Text>
                  <Text emphasis>Phases</Text>
                  <ScheduleTimeline
                    label="Life-phase durations"
                    total={model.result.total}
                    items={model.result.timeline}
                    showLegend={false}
                    startLabel="Plan start"
                    endLabel={model.result.durationLabel}
                  />
                  <DataTable
                    caption="Phase boundaries and ages"
                    columns={model.result.phaseColumns}
                    rows={model.result.phaseRows}
                  />
                  <Text muted>
                    End months are exclusive. The next phase starts exactly
                    where the previous one ends. End ages are measured at that
                    boundary, after the last included month. Schedule version:{' '}
                    {model.result.version}.
                  </Text>
                </Panel>
                {model.result.phases.map((phase) => (
                  <Panel key={phase.id} title={phase.label} icon="calculator">
                    <Text>Spending: {phase.spending}</Text>
                    <Text>
                      Automatic withdrawal order: {phase.withdrawalOrder}
                    </Text>
                    {phase.transfers.length > 0 && (
                      <DataTable
                        caption={`${phase.label}: active account transfer instructions (before estimated taxes)`}
                        columns={[
                          'Transfer (priority order)',
                          'Type',
                          'From',
                          'To',
                          'Amount instruction',
                        ]}
                        rows={phase.transfers}
                      />
                    )}
                    <DataTable
                      caption={`${phase.label}: effective account instructions and sources`}
                      columns={[
                        'Account',
                        'Contribution / source',
                        'Withdrawal / source',
                        'Annual fee / source',
                        'Rate / source',
                      ]}
                      rows={phase.rows}
                    />
                  </Panel>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Tabs>
    </Stack>
  )
}
