/*-----------------------------------------------
  Gate 108 shared completed-M1 valuation contract
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_DISCOVERY_VALUATION_MQH__
#define __LIMNI_PORTFOLIO_REVMA_DISCOVERY_VALUATION_MQH__

#include "RevmaDiscoveryTypes.mqh"
#include "..\\..\\Core\\SymbolUniverse.mqh"

bool LP_RevmaValueSnapshotDirection(
   const LP_SymbolMeta &meta,
   const LP_TickSnapshot &tick,
   const double q,
   const int direction,
   const double money_quantum,
   long &a_g_minor,
   long &margin_minor,
   long &immediate_minor,
   double &money_per_price_unit_per_atom)
{
   a_g_minor = 0;
   margin_minor = 0;
   immediate_minor = 0;
   money_per_price_unit_per_atom = 0.0;
   if(direction != LP_SIDE_LONG && direction != LP_SIDE_SHORT)
      return false;
   double open_price = direction == LP_SIDE_LONG ? tick.ask : tick.bid;
   double liquidation_price = direction == LP_SIDE_LONG ? tick.bid : tick.ask;
   double adverse_q_price = direction == LP_SIDE_LONG ?
      open_price - q : open_price + q;
   ENUM_ORDER_TYPE order_type = direction == LP_SIDE_LONG ?
      ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double q_profit = 0.0;
   double immediate_profit = 0.0;
   double margin_money = 0.0;
   if(adverse_q_price <= 0.0 ||
      !OrderCalcProfit(order_type, meta.broker_symbol,
         LP_REVMA_DISCOVERY_ATOM_LOTS, open_price, adverse_q_price,
         q_profit) ||
      !OrderCalcProfit(order_type, meta.broker_symbol,
         LP_REVMA_DISCOVERY_ATOM_LOTS, open_price, liquidation_price,
         immediate_profit) ||
      !OrderCalcMargin(order_type, meta.broker_symbol,
         LP_REVMA_DISCOVERY_ATOM_LOTS, open_price, margin_money) ||
      !MathIsValidNumber(q_profit) || q_profit >= 0.0 ||
      !MathIsValidNumber(immediate_profit) || immediate_profit > 0.0 ||
      !MathIsValidNumber(margin_money) || margin_money <= 0.0 ||
      !LP_RevmaDiscoveryMoneyBurdenToMinor(-q_profit, money_quantum,
         a_g_minor) || a_g_minor <= 0 ||
      !LP_RevmaDiscoveryMoneyToSignedMinor(immediate_profit,
         money_quantum, immediate_minor) || immediate_minor > 0 ||
      !LP_RevmaDiscoveryMoneyBurdenToMinor(margin_money, money_quantum,
         margin_minor) || margin_minor <= 0)
      return false;
   money_per_price_unit_per_atom = -q_profit / q;
   return money_per_price_unit_per_atom > 0.0 &&
      MathIsValidNumber(money_per_price_unit_per_atom);
}

bool LP_RevmaSnapshotDirectionValues(
   const LP_RevmaCompletedM1Snapshot &snapshot,
   const int direction,
   double &open_price,
   double &liquidation_price,
   long &a_g_candidate_minor,
   long &margin_minor,
   long &immediate_liquidation_minor,
   double &money_per_price_unit_per_atom)
{
   open_price = 0.0;
   liquidation_price = 0.0;
   a_g_candidate_minor = 0;
   margin_minor = 0;
   immediate_liquidation_minor = 0;
   money_per_price_unit_per_atom = 0.0;
   if(!LP_RevmaCompletedM1SnapshotValid(snapshot) ||
      (direction != LP_SIDE_LONG && direction != LP_SIDE_SHORT))
      return false;
   if(direction == LP_SIDE_LONG)
   {
      open_price = snapshot.ask;
      liquidation_price = snapshot.bid;
      a_g_candidate_minor = snapshot.long_a_g_candidate_minor;
      margin_minor = snapshot.long_incremental_margin_minor;
      immediate_liquidation_minor =
         snapshot.long_immediate_liquidation_minor;
      money_per_price_unit_per_atom =
         snapshot.long_money_per_price_unit_per_atom;
   }
   else
   {
      open_price = snapshot.bid;
      liquidation_price = snapshot.ask;
      a_g_candidate_minor = snapshot.short_a_g_candidate_minor;
      margin_minor = snapshot.short_incremental_margin_minor;
      immediate_liquidation_minor =
         snapshot.short_immediate_liquidation_minor;
      money_per_price_unit_per_atom =
         snapshot.short_money_per_price_unit_per_atom;
   }
   return open_price > 0.0 && liquidation_price > 0.0 &&
      a_g_candidate_minor > 0 && margin_minor > 0 &&
      immediate_liquidation_minor <= 0 &&
      money_per_price_unit_per_atom > 0.0;
}

bool LP_RevmaBuildCompletedM1Snapshot(
   const LP_SymbolMeta &meta,
   const LP_RevmaSignal &signal,
   const LP_TickSnapshot &tick,
   const bool session_allowed,
   const bool news_allowed,
   const string calendar_reason,
   LP_RevmaCompletedM1Snapshot &snapshot,
   string &reason)
{
   LP_ResetRevmaCompletedM1Snapshot(snapshot);
   reason = "";
   if(!signal.valid || signal.symbol_id != meta.symbol_id ||
      signal.symbol != meta.broker_symbol || signal.source_m1_time <= 0 ||
      ((long)signal.source_m1_time % 60) != 0 ||
      signal.initial_history_boundary <= 0 ||
      signal.initial_history_boundary > signal.source_m1_time ||
      signal.q <= 0.0 || signal.anchor <= 0.0 || signal.price <= 0.0 ||
      (signal.direction != LP_SIDE_LONG &&
       signal.direction != LP_SIDE_SHORT) ||
      !tick.valid || tick.symbol != meta.broker_symbol || tick.bid <= 0.0 ||
      tick.ask <= tick.bid || meta.tick_size <= 0.0 ||
      meta.base_ccy < 0 || meta.base_ccy >= LP_CCY_COUNT ||
      meta.quote_ccy < 0 || meta.quote_ccy >= LP_CCY_COUNT ||
      meta.base_ccy == meta.quote_ccy)
   {
      reason = "shared_snapshot_market_or_signal_input_invalid";
      return false;
   }
   string account_currency = AccountInfoString(ACCOUNT_CURRENCY);
   if(account_currency != LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY)
   {
      reason = "gate108_account_currency_profile_mismatch";
      return false;
   }

   double money_quantum = MathPow(10.0,
      -LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY_DIGITS);
   double open_price = signal.direction == LP_SIDE_LONG ? tick.ask : tick.bid;
   double liquidation_price = signal.direction == LP_SIDE_LONG ?
      tick.bid : tick.ask;
   long long_a_g_minor = 0;
   long short_a_g_minor = 0;
   long long_immediate_minor = 0;
   long short_immediate_minor = 0;
   long long_margin_minor = 0;
   long short_margin_minor = 0;
   double long_slope = 0.0;
   double short_slope = 0.0;
   long close_cost_minor = 0;
   if(!LP_RevmaValueSnapshotDirection(meta, tick, signal.q, LP_SIDE_LONG,
         money_quantum, long_a_g_minor, long_margin_minor,
         long_immediate_minor, long_slope) ||
      !LP_RevmaValueSnapshotDirection(meta, tick, signal.q, LP_SIDE_SHORT,
         money_quantum, short_a_g_minor, short_margin_minor,
         short_immediate_minor, short_slope) ||
      !LP_RevmaDiscoveryMoneyBurdenToMinor(0.0, money_quantum,
         close_cost_minor) || close_cost_minor != 0)
   {
      reason = "shared_snapshot_minor_currency_conversion_failed";
      return false;
   }
   long a_g_minor = signal.direction == LP_SIDE_LONG ?
      long_a_g_minor : short_a_g_minor;
   long margin_minor = signal.direction == LP_SIDE_LONG ?
      long_margin_minor : short_margin_minor;
   long immediate_minor = signal.direction == LP_SIDE_LONG ?
      long_immediate_minor : short_immediate_minor;
   double selected_slope = signal.direction == LP_SIDE_LONG ?
      long_slope : short_slope;

   ulong signal_identity = LP_RevmaDiscoverySignalIdentity(signal);
   ulong strategy_state_identity =
      LP_RevmaDiscoveryStrategyStateIdentity(signal);
   ulong center_identity = LP_HashString("gate108_center_update_identity_v1");
   LP_HashMixInt(center_identity, signal.symbol_id);
   LP_HashMixLong(center_identity, (long)signal.source_m1_time);
   LP_HashMixInt(center_identity, signal.q_event_count);
   LP_HashMixULong(center_identity, signal.reconstruction_epoch);
   LP_HashMixULong(center_identity,
      LP_HashString(DoubleToString(signal.anchor, 12)));
   ulong valuation_identity = LP_HashString(
      LP_REVMA_DISCOVERY_VALUATION_ID);
   LP_HashMixInt(valuation_identity, signal.symbol_id);
   LP_HashMixInt(valuation_identity, signal.direction);
   LP_HashMixLong(valuation_identity, (long)signal.source_m1_time);
   LP_HashMixULong(valuation_identity,
      LP_HashString(DoubleToString(open_price, 12)));
   LP_HashMixULong(valuation_identity,
      LP_HashString(DoubleToString(liquidation_price, 12)));
   LP_HashMixLong(valuation_identity, long_a_g_minor);
   LP_HashMixLong(valuation_identity, short_a_g_minor);
   LP_HashMixLong(valuation_identity, a_g_minor);
   LP_HashMixLong(valuation_identity, margin_minor);
   LP_HashMixLong(valuation_identity, immediate_minor);
   LP_HashMixLong(valuation_identity, close_cost_minor);
   LP_HashMixULong(valuation_identity, LP_RevmaDiscoveryFormulaHash());
   if(signal_identity == 0 || strategy_state_identity == 0 ||
      center_identity == 0 ||
      valuation_identity == 0)
   {
      reason = "shared_snapshot_identity_zero";
      return false;
   }

   snapshot.signal = signal;
   snapshot.symbol_id = meta.symbol_id;
   snapshot.canonical_symbol = meta.canonical_symbol;
   snapshot.broker_symbol = meta.broker_symbol;
   snapshot.base_currency_id = meta.base_ccy;
   snapshot.quote_currency_id = meta.quote_ccy;
   snapshot.source_m1_time = signal.source_m1_time;
   snapshot.initial_history_boundary = signal.initial_history_boundary;
   snapshot.signal_identity_hash = signal_identity;
   snapshot.strategy_state_identity_hash = strategy_state_identity;
   snapshot.center_update_identity = center_identity;
   snapshot.birth_eligible = signal.birth_eligible;
   snapshot.direction = signal.direction;
   snapshot.sleeve = signal.sleeve;
   snapshot.variant_id = signal.variant_id;
   snapshot.decision_price = signal.price;
   snapshot.birth_q = signal.q;
   snapshot.current_q = signal.q;
   snapshot.center = signal.anchor;
   snapshot.bid = tick.bid;
   snapshot.ask = tick.ask;
   snapshot.spread_price = tick.ask - tick.bid;
   snapshot.spread_points = tick.spread_points;
   snapshot.executable_open_price = open_price;
   snapshot.executable_liquidation_price = liquidation_price;
   snapshot.stress_reference_price = open_price;
   snapshot.fill_proxy_price = open_price;
   snapshot.broker_tick_size = meta.tick_size;
   snapshot.money_quantum = money_quantum;
   snapshot.account_currency = account_currency;
   snapshot.account_currency_digits =
      LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY_DIGITS;
   snapshot.a_g_candidate_minor = a_g_minor;
   snapshot.a_g_minor = a_g_minor;
   snapshot.incremental_margin_minor = margin_minor;
   snapshot.immediate_liquidation_minor = immediate_minor;
   snapshot.immediate_close_cost_minor = close_cost_minor;
   snapshot.account_money_per_price_unit_per_atom = selected_slope;
   snapshot.long_a_g_candidate_minor = long_a_g_minor;
   snapshot.short_a_g_candidate_minor = short_a_g_minor;
   snapshot.long_incremental_margin_minor = long_margin_minor;
   snapshot.short_incremental_margin_minor = short_margin_minor;
   snapshot.long_immediate_liquidation_minor = long_immediate_minor;
   snapshot.short_immediate_liquidation_minor = short_immediate_minor;
   snapshot.long_money_per_price_unit_per_atom = long_slope;
   snapshot.short_money_per_price_unit_per_atom = short_slope;
   snapshot.valuation_method_id = LP_REVMA_DISCOVERY_VALUATION_ID;
   snapshot.valuation_identity = valuation_identity;
   snapshot.session_allowed = session_allowed;
   snapshot.news_allowed = news_allowed;
   snapshot.calendar_reason = calendar_reason;
   snapshot.formula_hash = LP_RevmaDiscoveryFormulaHash();
   snapshot.profile_hash = LP_RevmaDiscoveryProfileHash();
   snapshot.snapshot_hash = LP_RevmaCompletedM1SnapshotIdentity(snapshot);
   snapshot.valid = snapshot.snapshot_hash != 0;
   if(!LP_RevmaCompletedM1SnapshotValid(snapshot))
   {
      LP_ResetRevmaCompletedM1Snapshot(snapshot);
      reason = "shared_snapshot_final_reconciliation_failed";
      return false;
   }
   reason = "shared_snapshot_ready";
   return true;
}

#endif // __LIMNI_PORTFOLIO_REVMA_DISCOVERY_VALUATION_MQH__
