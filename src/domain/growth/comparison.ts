export type AmountDifference =
  | { ok: true; amountCents: number; rate: number | null }
  | { ok: false; message: string }

export function compareAmounts(
  aCents: number,
  bCents: number,
): AmountDifference {
  const amountCents = bCents - aCents
  if (
    !Number.isSafeInteger(aCents) ||
    !Number.isSafeInteger(bCents) ||
    !Number.isSafeInteger(amountCents)
  ) {
    return {
      ok: false,
      message: 'Difference exceeds the supported integer-cent range.',
    }
  }
  return {
    ok: true,
    amountCents,
    rate: aCents > 0 ? amountCents / aCents : null,
  }
}
