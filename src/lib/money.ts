// Thai baht formatting: ฿25,000 — whole baht unless there are satang.
export function baht(amount: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(amount);
  const hasSatang = Math.round(abs * 100) % 100 !== 0;
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: hasSatang ? 2 : 0,
  });
  const sign = amount < 0 ? '−' : opts.sign && amount > 0 ? '+' : '';
  return `${sign}฿${body}`;
}
