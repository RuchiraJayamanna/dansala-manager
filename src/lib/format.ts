export const fmt = (n: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(n ?? 0);

const CURRENCY_SYMBOLS: Record<string, string> = {
  LKR: "Rs.",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  SGD: "S$",
};

export const money = (n: number, currency: string = "LKR") => {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym} ${fmt(n)}`;
};

/** Legacy alias — prefer money(n, currency). Kept so existing callers keep working. */
export const lkr = (n: number) => money(n, "LKR");