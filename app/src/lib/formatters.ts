const DEFAULT_CURRENCY = "USD";
const fallbackFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: DEFAULT_CURRENCY,
  maximumFractionDigits: 2,
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const key = currency.toUpperCase();
  const cached = currencyFormatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: key,
    maximumFractionDigits: 2,
  });
  currencyFormatters.set(key, formatter);
  return formatter;
}

export function formatCurrencySafe(
  value: number,
  currency?: string | null,
  fallbackCurrency = DEFAULT_CURRENCY,
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const trimmed = typeof currency === "string" ? currency.trim() : "";
  const candidate = trimmed || fallbackCurrency;

  try {
    return getCurrencyFormatter(candidate).format(safeValue);
  } catch {
    return fallbackFormatter.format(safeValue);
  }
}
