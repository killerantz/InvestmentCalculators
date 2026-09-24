export type ParsedNumber =
  { ok: true; value: number } | { ok: false; error: string }

export function parseMoney(value: string): ParsedNumber {
  const text = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    return {
      ok: false,
      error:
        'Enter nonnegative dollars with up to two decimal places, without commas or currency symbols.',
    }
  }
  const [whole, fraction = ''] = text.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(amount)
    ? { ok: true, value: amount }
    : { ok: false, error: 'This amount exceeds the supported numeric range.' }
}

export function parsePercentage(value: string): ParsedNumber {
  const text = value.trim()
  if (
    !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ||
    !Number.isFinite(Number(text))
  ) {
    return {
      ok: false,
      error:
        'Enter a finite percentage, such as 5 or 0.20, without a percent sign.',
    }
  }
  return { ok: true, value: Number(text) / 100 }
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatMoney(cents: number): string {
  const amount = BigInt(cents)
  const whole = amount / 100n
  const fraction = (amount < 0n ? -amount : amount) % 100n
  // Avoid losing a cent when converting large integer amounts to floating dollars.
  return currency
    .formatToParts(whole === 0n && amount < 0n ? -0 : whole)
    .map((part) =>
      part.type === 'fraction'
        ? fraction.toString().padStart(2, '0')
        : part.value,
    )
    .join('')
}
