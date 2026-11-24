/** Indian-grouped rupee amount, e.g. ₹1,25,000. Paise are shown only when present. */
export function formatINR(amount: number | undefined | null): string {
  const n = Number(amount) || 0;
  const hasPaise = Math.abs(n - Math.round(n)) > 0.004;
  const body = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : ''}₹${body}`;
}

/** Quantity without trailing zeros, e.g. 12, 12.5, 0.75. */
export function formatQty(qty: number | undefined | null, maxDecimals = 2): string {
  const n = Number(qty) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: maxDecimals });
}

/** Parses user-typed money/quantity; returns NaN for anything that is not a plain non-negative number. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[,₹\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d+$|^\d+\.?\d*$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/** Rounds to paise to keep sums free of binary floating-point drift. */
export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
