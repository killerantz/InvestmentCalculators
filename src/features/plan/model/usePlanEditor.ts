import { useMemo, useRef, useState } from 'react'
import {
  copyPlan,
  createExamplePlan,
  durationDraft,
  emptyChange,
  inheritedSettings,
  newAccount,
  removeAccount,
  removePhase,
  type PlanDraft,
  type RateDraft,
} from './draft'
import { evaluatePlan } from './evaluate'
import { scheduleView } from './scheduleView'
import { editorSections, groupEditorIssues } from './editorValidation'
import { editorField as field, type EditorField } from './editorFields'
import { evaluateProjection } from './evaluateProjection'
import { financeEditor } from './financeEditor'
import { financeDraft } from './financeDraft'
import { usePlanReport } from './usePlanReport'
import { transferEditor } from './transferEditor'
import { historicalBalanceContext } from './transferPresentation'
import { taxEditor } from './taxEditor'

type Option = { value: string; label: string }
export type { EditorField } from './editorFields'
const option = (value: string, label: string): Option => ({ value, label })
const kinds = [
  option('aggregate', 'Single combined portfolio (no account-level rules)'),
  option('savings', 'Savings / cash'),
  option('taxable', 'Taxable investments'),
  option('traditional-401k', 'Traditional workplace plan (401k)'),
  option('roth-401k', 'Roth workplace plan (401k)'),
  option('traditional-ira', 'Traditional IRA'),
  option('roth-ira', 'Roth IRA'),
]
const owners = [
  option('primary', 'Primary person'),
  option('partner', 'Partner'),
  option('joint', 'Joint'),
]
const rateKinds = [
  option('effective', 'Effective annual return / APY'),
  option('nominal', 'Nominal interest with compounding'),
]
const frequencies = [
  option('1', 'Annually'),
  option('2', 'Semiannually'),
  option('4', 'Quarterly'),
  option('12', 'Monthly'),
  option('365', 'Daily (365 periods)'),
]
const scalarSettings = [
  { key: 'contribution', label: 'Monthly external savings contribution ($)' },
  { key: 'withdrawal', label: 'Monthly scheduled transfer to spending ($)' },
  { key: 'fee', label: 'Annual fee (%)' },
] as const

export function usePlanEditor() {
  const [plans, setPlans] = useState<PlanDraft[]>(() => [createExamplePlan()])
  const [selected, setSelected] = useState('example')
  const [tab, setTab] = useState('household')
  const [outcome, setOutcome] = useState<
    (ReturnType<typeof evaluateProjection> & { request?: number }) | null
  >(null)
  const [pendingRemoval, setPendingRemoval] = useState<{
    kind: 'account' | 'phase' | 'income' | 'transfer'
    id: string
    label: string
  } | null>(null)
  const sequence = useRef(0)
  const plan = plans.find((item) => item.id === selected)
  const currentProjection = useMemo(
    () => (plan && outcome !== null ? evaluateProjection(plan) : null),
    [plan, outcome],
  )
  const report = usePlanReport(outcome?.ok ? outcome.projection : null, plan)
  if (!plan) throw new Error('The selected plan must exist.')
  const currentSchedule = evaluatePlan(plan)
  const currentScheduleView = currentSchedule.ok
    ? scheduleView(currentSchedule.plan, plan)
    : null
  const currentTimeline = currentScheduleView?.timeline ?? []
  const validationErrors =
    currentProjection && !currentProjection.ok ? currentProjection.errors : []
  const issueGroups = groupEditorIssues(validationErrors, plan)
  const duration = durationDraft(plan)
  function withErrors(
    fields: EditorField[],
    prefix: string,
    paths: Record<string, string>,
  ): EditorField[] {
    return fields.map((item) => {
      const path = `${prefix}${paths[item.id] ?? item.id}`
      const messages = validationErrors
        .filter(
          (error) =>
            error.path === path ||
            error.path.startsWith(`${path}.`) ||
            ((item.id === 'durationYears' || item.id === 'durationMonths') &&
              error.path === 'horizonMonths'),
        )
        .map((error) => error.message)
      return messages.length
        ? { ...item, error: [...new Set(messages)].join(' ') }
        : item
    })
  }
  const settingsPaths = {
    contribution: 'monthlyContributionCents',
    withdrawal: 'monthlyWithdrawalCents',
    fee: 'annualFeeRate',
    rateKind: 'rate.kind',
    annualRate: 'rate.annualRate',
    compounding: 'rate.periodsPerYear',
  }
  function update(change: (draft: PlanDraft) => void) {
    setPlans((current) =>
      current.map((item) => {
        if (item.id !== selected) return item
        const draft = structuredClone(item)
        change(draft)
        return draft
      }),
    )
    setOutcome((previous) =>
      previous === null
        ? null
        : {
            ok: false,
            errors: [],
            ...(previous.request === undefined
              ? {}
              : { request: previous.request }),
          },
    )
    setPendingRemoval(null)
  }
  const id = (prefix: string) => `${prefix}-${++sequence.current}`
  function rateFields(
    value: RateDraft,
    updateRate: (key: keyof RateDraft, value: string) => void,
  ): EditorField[] {
    return [
      field(
        'rateKind',
        'Rate convention',
        value.rateKind,
        (v) => updateRate('rateKind', v),
        rateKinds,
      ),
      field(
        'annualRate',
        'Annual rate (%)',
        value.annualRate,
        (v) => updateRate('annualRate', v),
        undefined,
        true,
        'Effective annual return / APY already includes compounding. Do not compound it again. With estimated taxes enabled, brokerage returns include reinvested dividends; do not add the dividend yield again.',
      ),
      ...(value.rateKind === 'nominal'
        ? [
            field(
              'compounding',
              'Compounding frequency',
              value.compounding,
              (v) => updateRate('compounding', v),
              frequencies,
            ),
          ]
        : []),
    ]
  }
  const householdFields = [
    field(
      'label',
      'Plan name',
      plan.label,
      (value) =>
        update((draft) => {
          draft.label = value
        }),
      undefined,
      false,
    ),
    field(
      'durationYears',
      'Planning duration (years)',
      duration.years,
      (value) =>
        update((draft) => {
          draft.duration = { ...durationDraft(draft), years: value }
        }),
      undefined,
      true,
      'Up to 100 years total. The schedule still uses monthly precision.',
    ),
    field(
      'durationMonths',
      'Additional duration months (0-11)',
      duration.months,
      (value) =>
        update((draft) => {
          draft.duration = { ...durationDraft(draft), months: value }
        }),
    ),
    ...(
      [
        ['startMonth', 'Planning start (YYYY-MM)', false],
        ['primaryYears', 'Primary age: years', true],
        ['primaryMonths', 'Primary age: additional months (0-11)', true],
        ...(plan.partnerEnabled
          ? [
              ['partnerYears', 'Partner age: years', true] as const,
              [
                'partnerMonths',
                'Partner age: additional months (0-11)',
                true,
              ] as const,
            ]
          : []),
      ] as const
    ).map(([key, label, numeric]) =>
      field(
        key,
        label,
        plan[key],
        (value) =>
          update((draft) => {
            draft[key] = value
          }),
        undefined,
        numeric,
      ),
    ),
  ]
  const accounts = plan.accounts.map((account, index) => ({
    id: account.id,
    label: account.label || `Account ${index + 1}`,
    fields: [
      field(
        'label',
        'Account nickname',
        account.label,
        (v) =>
          update((draft) => {
            draft.accounts[index]!.label = v
          }),
        undefined,
        false,
      ),
      field(
        'kind',
        'Account type',
        account.kind,
        (v) =>
          update((draft) => {
            draft.accounts[index]!.kind = v
          }),
        kinds,
      ),
      field(
        'owner',
        'Account owner',
        account.owner,
        (v) =>
          update((draft) => {
            draft.accounts[index]!.owner = v
          }),
        owners,
      ),
      field('balance', 'Starting balance ($)', account.balance, (v) =>
        update((draft) => {
          draft.accounts[index]!.balance = v
        }),
      ),
      ...(() => {
        const context = historicalBalanceContext(
          account.id,
          plan,
          currentSchedule.ok ? currentSchedule.plan : null,
        )
        return context.visible
          ? [
              field(
                'priorYearEndBalance',
                context.label,
                account.priorYearEndBalance ?? '',
                (v) =>
                  update((draft) => {
                    draft.accounts[index]!.priorYearEndBalance = v
                  }),
                undefined,
                true,
                context.hint,
              ),
            ]
          : []
      })(),
      ...scalarSettings.map(({ key, label }) =>
        field(key, label, account[key], (v) =>
          update((draft) => {
            draft.accounts[index]![key] = v
          }),
        ),
      ),
      ...rateFields(account, (key, v) =>
        update((draft) => {
          draft.accounts[index]![key] = v
        }),
      ),
    ],
    canRemove: plan.accounts.length > 1,
    remove: () =>
      setPendingRemoval({
        kind: 'account',
        id: account.id,
        label: account.label,
      }),
  }))
  const phases = plan.phases.map((phase, index) => ({
    id: phase.id,
    label: `Phase ${index + 1}: ${phase.label || 'Unnamed phase'}`,
    first: index === 0,
    boundary:
      currentTimeline[index]?.detail ??
      'Validate the plan to resolve calendar dates and both ages.',
    fields: [
      field(
        'label',
        'Phase name',
        phase.label,
        (v) =>
          update((draft) => {
            draft.phases[index]!.label = v
          }),
        undefined,
        false,
      ),
      ...(index === 0
        ? []
        : [
            field(
              'person',
              'Start at whose age?',
              phase.person,
              (v) =>
                update((draft) => {
                  draft.phases[index]!.person = v
                }),
              owners.slice(0, 2),
            ),
            field('years', 'Phase start age: years', phase.years, (v) =>
              update((draft) => {
                draft.phases[index]!.years = v
              }),
            ),
            field(
              'months',
              'Phase start age: additional months (0-11)',
              phase.months,
              (v) =>
                update((draft) => {
                  draft.phases[index]!.months = v
                }),
            ),
          ]),
    ],
    remove: () =>
      setPendingRemoval({ kind: 'phase', id: phase.id, label: phase.label }),
    accounts: plan.accounts.map((account) => {
      const change = phase.changes[account.id] ?? emptyChange()
      const inherited = inheritedSettings(plan, index, account.id)
      function editChange(
        edit: (change: ReturnType<typeof emptyChange>) => void,
      ) {
        update((draft) => {
          const changes = draft.phases[index]!.changes
          const change = changes[account.id] ?? emptyChange()
          changes[account.id] = change
          edit(change)
        })
      }
      return {
        id: account.id,
        label: account.label,
        settings: scalarSettings.map(({ key, label }) => ({
          id: key,
          label: `Override ${label}`,
          enabled: change[key] !== null,
          inherited: `${label}: ${inherited[key]} (carried forward)`,
          toggle: (checked: boolean) =>
            editChange((c) => {
              c[key] = checked ? inherited[key] : null
            }),
          fields:
            change[key] === null
              ? []
              : [
                  field(key, label, change[key], (v) =>
                    editChange((c) => {
                      c[key] = v
                    }),
                  ),
                ],
        })),
        rate: {
          enabled: change.rate !== null,
          inherited: `Rate: ${inherited.annualRate}% ${inherited.rateKind}${inherited.rateKind === 'nominal' ? `, ${inherited.compounding} periods/year` : ''} (carried forward)`,
          toggle: (checked: boolean) =>
            editChange((c) => {
              c.rate = checked
                ? {
                    rateKind: inherited.rateKind,
                    annualRate: inherited.annualRate,
                    compounding: inherited.compounding,
                  }
                : null
            }),
          fields:
            change.rate === null
              ? []
              : rateFields(change.rate, (key, v) =>
                  editChange((c) => {
                    if (!c.rate)
                      throw new Error(
                        'Enable the rate override before editing it.',
                      )
                    c.rate[key] = v
                  }),
                ),
        },
      }
    }),
  }))
  const finances = financeEditor(plan, update, validationErrors, (income) =>
    setPendingRemoval({ kind: 'income', id: income.id, label: income.label }),
  )
  return {
    finances,
    taxes: taxEditor(plan, update, validationErrors),
    transfers: transferEditor(
      plan,
      update,
      validationErrors,
      (transfer, label) =>
        setPendingRemoval({ kind: 'transfer', id: transfer.id, label }),
    ),
    addTransfer: () => {
      const transferId = id('transfer')
      update((draft) => {
        draft.finance ??= financeDraft(draft)
        draft.finance.transfers ??= []
        draft.finance.transfers.push({
          id: transferId,
          label: `Transfer ${draft.finance.transfers.length + 1}`,
          phaseId: '',
          kind: 'transfer',
          sourceAccountId: '',
          destinationAccountId: '',
          amount: '',
        })
      })
    },
    report,
    planEndSummary: currentScheduleView?.planEndSummary,
    addIncome: () => {
      const incomeId = id('income')
      update((draft) => {
        draft.finance ??= financeDraft(draft)
        draft.finance.incomes.push({
          id: incomeId,
          label: `Income ${draft.finance.incomes.length + 1}`,
          kind: 'social-security',
          person: 'primary',
          years: '67',
          months: '0',
          amount: '',
          increase: '0',
        })
      })
    },
    planOptions: plans.map((item) =>
      option(item.id, item.label || 'Unnamed plan'),
    ),
    selected,
    selectPlan: (value: string) => {
      setSelected(value)
      setOutcome(null)
      setPendingRemoval(null)
    },
    duplicate: () => {
      const copy = copyPlan(plan, id('plan'))
      setPlans((current) => [...current, copy])
      setSelected(copy.id)
      setOutcome(null)
      setPendingRemoval(null)
    },
    tab,
    setTab,
    sections: editorSections.map((section) => {
      const count =
        issueGroups.find((group) => group.value === section.value)?.issues
          .length ?? 0
      return {
        ...section,
        label: count
          ? `${section.label} (${count} ${count === 1 ? 'issue' : 'issues'})`
          : section.label,
      }
    }),
    issueGroups: issueGroups.map((group) => ({
      ...group,
      go: () => setTab(group.value),
    })),
    validationRequest: outcome?.request,
    householdFields: withErrors(householdFields, '', {
      primaryYears: 'primaryAgeMonths',
      primaryMonths: 'primaryAgeMonths',
      partnerYears: 'partnerAgeMonths',
      partnerMonths: 'partnerAgeMonths',
      durationYears: 'duration.years',
      durationMonths: 'duration.months',
    }),
    partnerEnabled: plan.partnerEnabled,
    setPartnerEnabled: (value: boolean) =>
      update((draft) => {
        draft.partnerEnabled = value
      }),
    accounts: accounts.map((account, index) => ({
      ...account,
      fields: withErrors(account.fields, `accounts.${index}.`, {
        balance: 'startingBalanceCents',
        priorYearEndBalance: 'priorYearEndBalanceCents',
        ...Object.fromEntries(
          Object.entries(settingsPaths).map(([key, value]) => [
            key,
            `settings.${value}`,
          ]),
        ),
      }),
    })),
    phases: phases.map((phase, index) => ({
      ...phase,
      cashFlow: finances.phases[index]!,
      fields: withErrors(phase.fields, `phases.${index}.`, {
        person: 'start.person',
        years: 'start.ageMonths',
        months: 'start.ageMonths',
      }),
      accounts: phase.accounts.map((account) => {
        const changes = plan.phases[index]?.changes ?? {}
        const changeIndex = Object.entries(changes)
          .filter(([, change]) =>
            Object.values(change).some((value) => value !== null),
          )
          .findIndex(([id]) => id === account.id)
        const prefix = `phases.${index}.changes.${changeIndex}.`
        return {
          ...account,
          settings: account.settings.map((setting) => ({
            ...setting,
            fields: withErrors(setting.fields, prefix, settingsPaths),
          })),
          rate: {
            ...account.rate,
            fields: withErrors(account.rate.fields, prefix, settingsPaths),
          },
        }
      }),
    })),
    addAccount: () => {
      const account = newAccount(id('account'))
      update((draft) => {
        draft.accounts.push(account)
      })
    },
    addPhase: () => {
      const phaseId = id('phase')
      update((draft) => {
        draft.phases.push({
          id: phaseId,
          label: 'New phase',
          person: 'primary',
          years: '',
          months: '0',
          changes: {},
        })
      })
    },
    pendingRemoval,
    cancelRemoval: () => setPendingRemoval(null),
    confirmRemoval: () => {
      if (!pendingRemoval) return
      update((draft) => {
        if (pendingRemoval.kind === 'account') {
          removeAccount(draft, pendingRemoval.id)
        } else if (pendingRemoval.kind === 'phase') {
          removePhase(draft, pendingRemoval.id)
        } else if (pendingRemoval.kind === 'transfer') {
          draft.finance ??= financeDraft(draft)
          draft.finance.transfers = (draft.finance.transfers ?? []).filter(
            (transfer) => transfer.id !== pendingRemoval.id,
          )
        } else {
          draft.finance ??= financeDraft(draft)
          draft.finance.incomes = draft.finance.incomes.filter(
            (income) => income.id !== pendingRemoval.id,
          )
          if (draft.taxes) delete draft.taxes.incomeShares[pendingRemoval.id]
        }
      })
    },
    preview: () => {
      setOutcome({ ...evaluateProjection(plan), request: ++sequence.current })
      setTab('preview')
    },
    project: () => {
      setOutcome({ ...evaluateProjection(plan), request: ++sequence.current })
      setTab('report')
    },
    result: outcome?.ok
      ? scheduleView(outcome.projection.schedule, plan)
      : null,
  }
}
export type PlanEditorModel = ReturnType<typeof usePlanEditor>
