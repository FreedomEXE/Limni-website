export type AccountCard = {
  account_id: string;
  label: string;
  broker: string;
  server: string;
  status: string;
  currency: string;
  equity: number | null;
  weekly_pnl_pct: number | null;
  basket_state: string;
  open_positions: number | null;
  open_pairs: number | null;
  win_rate_pct: number | null;
  max_drawdown_pct: number | null;
  source: "mt5" | "bitget" | "oanda";
  href?: string;
};
