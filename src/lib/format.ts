export const fmt = (n: number) => new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(n ?? 0);
export const lkr = (n: number) => `Rs. ${fmt(n)}`;