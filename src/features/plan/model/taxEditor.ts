import type { PlanIssue } from '../../../domain/plan'
import type { PlanDraft } from './draft'
import { editorField, type EditorField } from './editorFields'
import {
  accountTaxDraft,
  inheritedTaxRates,
  inheritedTaxPaymentOrder,
  newTaxDraft,
  type TaxDraft,
  type TaxPhaseDraft,
} from './taxDraft'
import { financeDraft, inheritedCashFlow } from './financeDraft'
import { withdrawalOrderEditor } from './withdrawalOrderEditor'

const rateFields = [
  {
    key: 'ordinaryRate',
    label: 'Estimated ordinary-income tax rate (%)',
    help: 'Your planning rate on taxable traditional retirement withdrawals, conversions, savings interest, ordinary dividends, and the taxable portion of pension/Social Security income. For example, 20 means $20 tax per $100 of taxable income. No brackets or deductions are calculated. Enter an explicit 0 if you assume no tax.',
  },
  {
    key: 'capitalGainsRate',
    label: 'Estimated realized-gain tax rate (%)',
    help: 'Applies only to positive gains when brokerage investments are sold, not the whole withdrawal. A $1,000 sale with $800 of pooled cost basis has a $200 gain. Uses one rate for all holding periods. Losses receive no credit or offset in this simplified planner.',
  },
  {
    key: 'qualifiedDividendRate',
    label: 'Estimated qualified-dividend tax rate (%)',
    help: 'Applies to the qualified portion of estimated brokerage dividends. This is a tax rate, not the dividend yield. The planner does not determine whether dividends legally qualify.',
  },
] as const

export function taxEditor(
  plan: PlanDraft,
  update: (edit: (draft: PlanDraft) => void) => void,
  errors: readonly PlanIssue[],
) {
  const taxes = plan.taxes ?? newTaxDraft()
  function edit(change: (taxes: TaxDraft) => void) {
    update((draft) => {
      draft.taxes ??= newTaxDraft()
      change(draft.taxes)
    })
  }
  function field(
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    help: string,
  ): EditorField {
    const error = errors
      .filter((issue) => issue.path === id)
      .map((issue) => issue.message)
      .join(' ')
    return {
      ...editorField(id, label, value, onChange),
      help,
      ...(error ? { error } : {}),
    }
  }
  const taxableAccounts = plan.accounts.filter(
    (account) => account.kind === 'taxable',
  )
  const overridePhases = plan.phases.filter(
    (phase) => Object.keys(taxes.phaseRates[phase.id] ?? {}).length > 0,
  )
  const orderError = (path: string) =>
    errors
      .filter(
        (issue) => issue.path === path || issue.path.startsWith(`${path}.`),
      )
      .map((issue) => issue.message)
      .join(' ')
  const orderNames = (order: readonly string[]) =>
    order.length
      ? order
          .map(
            (id) =>
              plan.accounts.find((account) => account.id === id)?.label ?? id,
          )
          .join(' > ')
      : 'No accounts selected'
  return {
    enabled: taxes.enabled,
    toggle: (enabled: boolean) =>
      edit((taxes) => {
        taxes.enabled = enabled
      }),
    hasAggregate: plan.accounts.some((account) => account.kind === 'aggregate'),
    separateOrder: taxes.paymentOrder !== undefined,
    toggleSeparateOrder: (enabled: boolean) =>
      edit((taxes) => {
        if (enabled)
          taxes.paymentOrder = [...financeDraft(plan).withdrawalOrder]
        else delete taxes.paymentOrder
      }),
    order: withdrawalOrderEditor(
      plan,
      taxes.paymentOrder ?? [],
      (order) =>
        edit((taxes) => {
          taxes.paymentOrder = order
        }),
      orderError('taxes.paymentOrder'),
      'tax payment',
    ),
    fields: rateFields.map(({ key, label, help }) =>
      field(
        `taxes.${key}`,
        label,
        taxes[key],
        (value) =>
          edit((taxes) => {
            taxes[key] = value
          }),
        help,
      ),
    ),
    accounts: taxableAccounts.map((account, index) => {
      const values = taxes.accounts[account.id] ?? accountTaxDraft()
      const descriptors = [
        {
          key: 'costBasis',
          property: 'costBasisCents',
          label: 'Starting pooled cost basis ($)',
          help: 'The tax cost of investments you already own, not their current market value. If this account is worth $100,000 and those holdings cost $70,000, enter 70000. Required when taxes are enabled; enter 0 only if you intentionally assume zero basis. Sales remove proportional basis; contributions and estimated reinvested dividends add basis.',
        },
        {
          key: 'dividendYield',
          property: 'annualDividendYield',
          label: 'Annual dividend yield (%)',
          help: 'Estimated yearly dividends as a percentage of account value. Enter 3 for 3%. Monthly dividends use opening balance times yield divided by 12. They are assumed reinvested and ALREADY included in the account return, so this field adds estimated tax and basis, not extra growth or spendable cash. Leave 0 to assume no dividends; 0–100% supported.',
        },
        {
          key: 'qualifiedShare',
          property: 'qualifiedDividendShare',
          label: 'Qualified share of dividends (%)',
          help: 'How much of the dividend payout uses your qualified-dividend tax rate. Enter 60 if $60 of every $100 in dividends is qualified. The remaining 40% uses your ordinary-income rate. The default 0 treats all dividends as ordinary. This is not the tax rate itself.',
        },
      ] as const
      return {
        id: account.id,
        label: account.label,
        fields: descriptors.map(({ key, property, label, help }) =>
          field(
            `taxes.accounts.${index}.${property}`,
            label,
            values[key],
            (value) =>
              edit((taxes) => {
                taxes.accounts[account.id] ??= accountTaxDraft()
                taxes.accounts[account.id]![key] = value
              }),
            help,
          ),
        ),
      }
    }),
    incomes: (plan.finance?.incomes ?? []).map((income, index) => ({
      id: income.id,
      label: income.label,
      fields: [
        field(
          `taxes.incomes.${index}.taxableShare`,
          'Taxable share of payment (%)',
          taxes.incomeShares[income.id] ??
            (income.kind === 'pension' ? '100' : ''),
          (value) =>
            edit((taxes) => {
              taxes.incomeShares[income.id] = value
            }),
          income.kind === 'social-security'
            ? 'Enter your assumed taxable portion from 0 to 85%, not your tax rate. At 50%, a $2,000 payment adds $1,000 of ordinary taxable income. The planner does not calculate this share from household income. An explicit assumption is required.'
            : 'The portion of the pension payment subject to ordinary-income tax, from 0 to 100%. Defaults to fully taxable. Reduce this if part of the payment is a return of after-tax contributions.',
        ),
      ],
    })),
    phases: plan.phases.map((phase, phaseIndex) => {
      const inherited = inheritedTaxRates(plan, phaseIndex)
      const overrides = taxes.phaseRates[phase.id] ?? {}
      const overrideIndex = overridePhases.findIndex(
        (item) => item.id === phase.id,
      )
      const inheritedOrder = inheritedTaxPaymentOrder(plan, phaseIndex)
      const spendingOrder = inheritedCashFlow(
        plan,
        phaseIndex + 1,
      ).withdrawalOrder
      return {
        id: phase.id,
        label: phase.label,
        orderInherited:
          inheritedOrder === null
            ? `Carried forward: follow this phase's spending order (${orderNames(spendingOrder)}).`
            : `Carried-forward tax order: ${orderNames(inheritedOrder)}. Spending order is the fallback.`,
        orderFields: [
          editorField(
            `tax-order-mode-${phase.id}`,
            'Tax payment order for this phase',
            overrides.paymentOrder === undefined
              ? 'inherit'
              : overrides.paymentOrder === null
                ? 'follow'
                : 'custom',
            (value) =>
              edit((taxes) => {
                taxes.phaseRates[phase.id] ??= {}
                const override = taxes.phaseRates[phase.id]!
                if (value === 'inherit') delete override.paymentOrder
                else if (value === 'follow') override.paymentOrder = null
                else if (value === 'custom')
                  override.paymentOrder = [...(inheritedOrder ?? spendingOrder)]
                else throw new Error('Unknown tax payment order mode.')
              }),
            [
              {
                value: 'inherit',
                label: 'Inherit previous tax setting',
              },
              {
                value: 'follow',
                label: 'Follow the spending order',
              },
              { value: 'custom', label: 'Use a separate tax order' },
            ],
          ),
        ],
        order:
          overrides.paymentOrder === undefined ||
          overrides.paymentOrder === null
            ? undefined
            : withdrawalOrderEditor(
                plan,
                overrides.paymentOrder,
                (order) =>
                  edit((taxes) => {
                    taxes.phaseRates[phase.id] ??= {}
                    taxes.phaseRates[phase.id]!.paymentOrder = order
                  }),
                orderError(`taxes.phaseRates.${overrideIndex}.paymentOrder`),
                'tax payment',
              ),
        rates: rateFields.map(({ key, label, help }) => ({
          id: key,
          label: `Override ${label}`,
          enabled: overrides[key] !== undefined,
          inherited: `${label}: ${inherited[key] || 'not entered'}${inherited[key] ? '%' : ''} (carried forward)`,
          toggle: (checked: boolean) =>
            edit((taxes) => {
              taxes.phaseRates[phase.id] ??= {}
              if (checked) taxes.phaseRates[phase.id]![key] = inherited[key]
              else delete taxes.phaseRates[phase.id]![key]
            }),
          fields:
            overrides[key] === undefined
              ? []
              : [
                  field(
                    `taxes.phaseRates.${overrideIndex}.${key}`,
                    label,
                    overrides[key],
                    (value) =>
                      edit((taxes) => {
                        const rates: TaxPhaseDraft =
                          taxes.phaseRates[phase.id] ?? {}
                        rates[key] = value
                        taxes.phaseRates[phase.id] = rates
                      }),
                    help,
                  ),
                ],
        })),
      }
    }),
  }
}

export type TaxEditorModel = ReturnType<typeof taxEditor>
