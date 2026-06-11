export type AccountClientViewLayout = {
  metricLabel: string;
  sizeUnitLabel: string;
  rowGridCols: string;
  openGridCols: string;
};

export function getAccountClientViewLayout(providerLabel: string, isOanda: boolean): AccountClientViewLayout {
  const providerKey = providerLabel.toLowerCase();
  return {
    metricLabel: "P/L",
    sizeUnitLabel: isOanda ? "units" : providerKey === "bitget" ? "qty" : "lots",
    rowGridCols:
      "grid-cols-[minmax(160px,1.2fr)_minmax(110px,0.7fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(110px,0.5fr)]",
    openGridCols:
      "grid-cols-[minmax(160px,1.2fr)_minmax(110px,0.6fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)_minmax(120px,0.6fr)_minmax(110px,0.5fr)]",
  };
}

export function formatStopLossValue(symbol: string, value: number) {
  const upper = symbol.toUpperCase();
  const decimals = upper.includes("JPY") ? 3 : 5;
  return value.toFixed(decimals);
}
