import { CheckboxField, IconButton, Notice, Row, Stack, Text } from '@ui'
import type { WithdrawalOrderModel } from '../model/withdrawalOrderEditor'

export function WithdrawalOrder({ model }: { model: WithdrawalOrderModel }) {
  return (
    <Stack>
      {model.error && <Notice tone="error">{model.error}</Notice>}
      {model.empty && <Text>{model.emptyMessage}</Text>}
      {model.accounts.map((account) => (
        <Row key={account.id}>
          <CheckboxField
            label={account.label}
            checked={account.checked}
            onChange={account.toggle}
          />
          {account.checked && (
            <Row>
              <IconButton
                label={account.earlierLabel}
                icon="up"
                disabled={!account.canMoveEarlier}
                onClick={account.earlier}
              />
              <IconButton
                label={account.laterLabel}
                icon="down"
                disabled={!account.canMoveLater}
                onClick={account.later}
              />
            </Row>
          )}
        </Row>
      ))}
    </Stack>
  )
}
