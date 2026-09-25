import type { PlanIssue } from '../../../domain/plan'
import type { PlanDraft } from './draft'
import { editorField as field, type EditorField } from './editorFields'
import {
  financeDraft,
  inheritedCashFlow,
  type FinanceDraft,
  type IncomeDraft,
  type CashFlowDraft,
} from './financeDraft'
import { withdrawalOrderEditor } from './withdrawalOrderEditor'

export function financeEditor(
  plan: PlanDraft,
  update: (edit: (draft: PlanDraft) => void) => void,
  errors: readonly PlanIssue[],
  removeIncome: (income: IncomeDraft) => void,
) {
  const finance = financeDraft(plan)
  function editFinance(edit: (draft: FinanceDraft) => void) {
    update((draft) => {
      draft.finance ??= financeDraft(draft)
      edit(draft.finance)
    })
  }
  function errorAt(path: string) {
    return errors
      .filter(
        (issue) => issue.path === path || issue.path.startsWith(`${path}.`),
      )
      .map((issue) => issue.message)
      .join(' ')
  }
  function fieldsWithErrors(fields: EditorField[], prefix = '') {
    return fields.map((item) => {
      const error = errorAt(`${prefix}${item.id}`)
      return error ? { ...item, error } : item
    })
  }
  function orderEditor(
    order: readonly string[],
    setOrder: (order: string[]) => void,
    path: string,
  ) {
    return withdrawalOrderEditor(plan, order, setOrder, errorAt(path))
  }
  return {
    fields: fieldsWithErrors([
      field(
        'cashAccountId',
        'Deposit surplus into',
        finance.cashAccountId,
        (v) =>
          editFinance((f) => {
            f.cashAccountId = v
          }),
        [
          { value: '', label: 'Choose a savings / cash account' },
          ...plan.accounts
            .filter(
              (account) =>
                account.kind === 'savings' || account.kind === 'aggregate',
            )
            .map((account) => ({ value: account.id, label: account.label })),
        ],
        false,
        'A combined portfolio is also supported when it is the only account.',
      ),
      field(
        'monthlySpendingCents',
        'Initial monthly spending to fund ($)',
        finance.spending,
        (v) =>
          editFinance((f) => {
            f.spending = v
          }),
        undefined,
        true,
        'Only enter spending you want these income streams and accounts to fund. Fixed nominal dollars until a phase changes it. Use 0 for an accumulation-only phase.',
      ),
      field(
        'annualInflationRate',
        "Annual inflation for today's-dollar reports (%)",
        finance.inflation,
        (v) =>
          editFinance((f) => {
            f.inflation = v
          }),
        undefined,
        true,
        'Reporting assumption only. Does not automatically increase spending or income.',
      ),
    ]),
    order: orderEditor(
      finance.withdrawalOrder,
      (order) =>
        editFinance((f) => {
          f.withdrawalOrder = order
        }),
      'withdrawalOrder',
    ),
    incomes: finance.incomes.map((income, index) => {
      const edit = (key: keyof IncomeDraft, value: string) =>
        editFinance((f) => {
          f.incomes[index]![key] = value
        })
      return {
        id: income.id,
        label: income.label || `Income ${index + 1}`,
        remove: () => removeIncome(income),
        fields: fieldsWithErrors(
          [
            field(
              'label',
              'Income name',
              income.label,
              (v) => edit('label', v),
              undefined,
              false,
            ),
            field('kind', 'Income type', income.kind, (v) => edit('kind', v), [
              { value: 'social-security', label: 'Social Security' },
              { value: 'pension', label: 'Pension' },
            ]),
            field(
              'person',
              'Recipient',
              income.person,
              (v) => edit('person', v),
              [
                { value: 'primary', label: 'Primary person' },
                { value: 'partner', label: 'Partner' },
              ],
            ),
            field(
              'startAgeMonths',
              'Payment start age: years',
              income.years,
              (v) => edit('years', v),
            ),
            field(
              'startAgeMonths',
              'Payment start age: additional months (0-11)',
              income.months,
              (v) => edit('months', v),
            ),
            field(
              'monthlyAmountCents',
              'Monthly payment at start age ($)',
              income.amount,
              (v) => edit('amount', v),
              undefined,
              true,
              "Nominal amount when payments first begin, not today's dollars. If payments began before the plan, enter the original start-age amount.",
            ),
            field(
              'annualIncreaseRate',
              'Assumed annual payment increase (%)',
              income.increase,
              (v) => edit('increase', v),
              undefined,
              true,
              'Your assumption, not an official COLA or pension rule. First increase after 12 payment months, then each start anniversary. Use 0 for a fixed pension.',
            ),
          ],
          `incomes.${index}.`,
        ).map((item, fieldIndex) => ({
          ...item,
          id: `${item.id}-${fieldIndex}`,
        })),
      }
    }),
    phases: plan.phases.map((phase, index) => {
      const inherited = inheritedCashFlow(plan, index)
      const flow = phase.cashFlow ?? { spending: null, withdrawalOrder: null }
      function edit(editFlow: (flow: CashFlowDraft) => void) {
        update((draft) => {
          const current = draft.phases[index]!
          current.cashFlow ??= { spending: null, withdrawalOrder: null }
          editFlow(current.cashFlow)
        })
      }
      return {
        spendingEnabled: flow.spending !== null,
        spendingToggle: (checked: boolean) =>
          edit((f) => {
            f.spending = checked ? inherited.spending : null
          }),
        spendingInherited: `Monthly spending: $${inherited.spending} (carried forward, nominal dollars)`,
        fields: fieldsWithErrors(
          [
            field(
              'monthlySpendingCents',
              'Monthly spending in this phase ($)',
              flow.spending ?? inherited.spending,
              (v) =>
                edit((f) => {
                  f.spending = v
                }),
            ),
          ],
          `phases.${index}.cashFlow.`,
        ),
        orderEnabled: flow.withdrawalOrder !== null,
        orderToggle: (checked: boolean) =>
          edit((f) => {
            f.withdrawalOrder = checked ? [...inherited.withdrawalOrder] : null
          }),
        orderInherited: inherited.withdrawalOrder.length
          ? `Carried-forward order: ${inherited.withdrawalOrder.map((id) => plan.accounts.find((a) => a.id === id)?.label ?? id).join(' > ')}`
          : 'No automatic withdrawals (carried forward). Unfunded spending is reported.',
        order: orderEditor(
          flow.withdrawalOrder ?? inherited.withdrawalOrder,
          (order) =>
            edit((f) => {
              f.withdrawalOrder = order
            }),
          `phases.${index}.cashFlow.withdrawalOrder`,
        ),
      }
    }),
  }
}
export type { WithdrawalOrderModel } from './withdrawalOrderEditor'
