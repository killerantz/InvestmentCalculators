import type { PlanDraft } from './draft'
import { moveWithdrawal } from './financeDraft'

export function withdrawalOrderEditor(
  plan: PlanDraft,
  order: readonly string[],
  setOrder: (order: string[]) => void,
  error: string,
  purpose: 'withdrawal' | 'tax payment' = 'withdrawal',
) {
  const accounts = [
    ...order.flatMap((id) =>
      plan.accounts.filter((account) => account.id === id),
    ),
    ...plan.accounts.filter((account) => !order.includes(account.id)),
  ]
  return {
    error,
    empty: order.length === 0,
    emptyMessage:
      purpose === 'tax payment'
        ? 'No preferred tax accounts. Tax funding falls back to the spending withdrawal order.'
        : 'No automatic withdrawals. Any remaining spending gap will be reported.',
    accounts: accounts.map((account) => {
      const index = order.indexOf(account.id)
      return {
        id: account.id,
        label:
          index < 0
            ? `${account.label} (excluded)`
            : `${index + 1}. ${account.label}`,
        checked: index >= 0,
        toggle: (checked: boolean) =>
          setOrder(
            checked
              ? [...order, account.id]
              : order.filter((id) => id !== account.id),
          ),
        earlierLabel: `Move ${account.label} earlier in ${purpose} order`,
        laterLabel: `Move ${account.label} later in ${purpose} order`,
        canMoveEarlier: index > 0,
        canMoveLater: index >= 0 && index < order.length - 1,
        earlier: () => setOrder(moveWithdrawal(order, account.id, -1)),
        later: () => setOrder(moveWithdrawal(order, account.id, 1)),
      }
    }),
  }
}

export type WithdrawalOrderModel = ReturnType<typeof withdrawalOrderEditor>
