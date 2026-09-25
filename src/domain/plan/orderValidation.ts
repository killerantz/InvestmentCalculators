import type { PlanIssue } from './types'
import { collection, text } from './validation'

export function accountOrder(
  value: unknown,
  path: string,
  issues: PlanIssue[],
  accountIds?: ReadonlySet<string>,
) {
  const seen = new Set<string>()
  return collection(
    value,
    path,
    false,
    (item, itemPath, itemIssues) => {
      const id = text(item, itemPath, itemIssues)
      if (id !== undefined) {
        if (accountIds && !accountIds.has(id))
          itemIssues.push({
            path: itemPath,
            message: 'The referenced account does not exist.',
          })
        if (seen.has(id))
          itemIssues.push({
            path: itemPath,
            message: 'Withdrawal order must not repeat an account.',
          })
        seen.add(id)
      }
      return id
    },
    issues,
  )
}
