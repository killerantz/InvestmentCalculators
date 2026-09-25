import type { PlanIssue } from '../../../domain/plan'
import type { PlanDraft } from './draft'
import { transferName } from './transferPresentation'

export const editorSections = [
  { value: 'household', label: 'Household' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'income', label: 'Income & spending' },
  { value: 'phases', label: 'Phases' },
  { value: 'transfers', label: 'Transfers & conversions' },
  { value: 'taxes', label: 'Tax assumptions' },
  { value: 'preview', label: 'Schedule preview' },
  { value: 'report', label: 'Projection report' },
] as const

const fieldNames: Record<string, string> = {
  startMonth: 'Planning start',
  horizonMonths: 'Planning duration',
  primaryAgeMonths: 'Primary age',
  partnerAgeMonths: 'Partner age',
  years: 'Years',
  months: 'Additional months',
  label: 'Name',
  kind: 'Type',
  owner: 'Owner',
  startingBalanceCents: 'Starting balance',
  priorYearEndBalanceCents: 'Prior year-end balance',
  amountKind: 'Amount method',
  monthlyContributionCents: 'Monthly contribution',
  monthlyWithdrawalCents: 'Monthly withdrawal',
  annualFeeRate: 'Annual fee',
  annualRate: 'Annual rate',
  periodsPerYear: 'Compounding frequency',
  ageMonths: 'Start age',
  person: 'Age anchor',
  startAgeMonths: 'Payment start age',
  monthlyAmountCents: 'Monthly payment at start',
  annualIncreaseRate: 'Annual payment increase',
  monthlySpendingCents: 'Monthly spending',
  cashAccountId: 'Surplus destination',
  withdrawalOrder: 'Withdrawal order',
  annualInflationRate: 'Reporting inflation',
  phaseId: 'Starting phase',
  endPhaseId: 'Ending phase',
  sourceAccountId: 'From account',
  destinationAccountId: 'To account',
  ordinaryRate: 'Ordinary-income tax rate',
  capitalGainsRate: 'Realized-gain tax rate',
  qualifiedDividendRate: 'Qualified-dividend tax rate',
  costBasisCents: 'Starting pooled cost basis',
  annualDividendYield: 'Annual dividend yield',
  qualifiedDividendShare: 'Qualified share of dividends',
  taxableShare: 'Taxable share of payment',
  paymentOrder: 'Tax payment order',
}

export function groupEditorIssues(
  errors: readonly PlanIssue[],
  draft: PlanDraft,
) {
  return editorSections
    .map((section) => {
      const issues = errors
        .filter((error) => {
          const root = error.path.split('.')[0]
          const target =
            root === 'accounts' ||
            root === 'phases' ||
            root === 'transfers' ||
            root === 'taxes'
              ? root
              : [
                    'incomes',
                    'cashAccountId',
                    'monthlySpendingCents',
                    'withdrawalOrder',
                    'annualInflationRate',
                  ].includes(root ?? '')
                ? 'income'
                : root === 'calculation'
                  ? 'report'
                  : 'household'
          return section.value === target
        })
        .map((error) => {
          const parts = error.path.split('.')
          const index = Number(parts[1])
          const context =
            parts[0] === 'taxes'
              ? taxIssueContext(parts, draft)
              : parts[0] === 'accounts' && draft.accounts[index]
                ? `Account ${index + 1}: ${draft.accounts[index].label}`
                : parts[0] === 'phases' && draft.phases[index]
                  ? `Phase ${index + 1}: ${draft.phases[index].label}`
                  : parts[0] === 'incomes' && draft.finance?.incomes[index]
                    ? `Income ${index + 1}: ${draft.finance.incomes[index].label}`
                    : parts[0] === 'transfers' &&
                        draft.finance?.transfers?.[index]
                      ? transferName(draft.finance.transfers[index], index)
                      : section.label
          const field =
            parts[0] === 'taxes' && parts.includes('paymentOrder')
              ? 'Tax payment order'
              : parts[0] === 'transfers' &&
                  parts.at(-1) === 'monthlyAmountCents'
                ? 'Monthly amount to move'
                : parts[0] === 'transfers' && parts.at(-1) === 'annualRate'
                  ? 'Annual percentage to move'
                  : (fieldNames[parts.at(-1) ?? ''] ?? 'Plan settings')
          return `${context} - ${field}: ${error.message}`
        })
      return { ...section, issues }
    })
    .filter((section) => section.issues.length > 0)
}

function taxIssueContext(parts: string[], draft: PlanDraft) {
  const index = Number(parts[2])
  if (parts[1] === 'accounts')
    return (
      draft.accounts.filter((account) => account.kind === 'taxable')[index]
        ?.label ?? 'Brokerage tax details'
    )
  if (parts[1] === 'incomes')
    return draft.finance?.incomes[index]?.label ?? 'Income tax details'
  if (parts[1] === 'phaseRates')
    return (
      draft.phases.filter(
        (phase) =>
          Object.keys(draft.taxes?.phaseRates[phase.id] ?? {}).length > 0,
      )[index]?.label ?? 'Phase tax rates'
    )
  return 'Tax assumptions'
}
