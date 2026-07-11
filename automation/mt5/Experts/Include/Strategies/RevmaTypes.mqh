/*-----------------------------------------------
  Revma v001 mean-reversion system contracts
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_TYPES_MQH__
#define __LIMNI_PORTFOLIO_REVMA_TYPES_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\..\\..\\Indicators\\Include\\LimniPairDirectionCore.mqh"

#define LP_REVMA_SYSTEM_ID "revma-v001"
#define LP_REVMA_SYSTEM_NAME "Revma v001"
#define LP_REVMA_FORMULA_ID "revma-mean-reversion-grid-v001"

enum LP_RevmaSleeve
{
   LP_REVMA_SLEEVE_NONE = 0,
   LP_REVMA_SLEEVE_REVERSION = 2
};

string LP_UniverseModeName(const int mode)
{
   if(mode == LP_UNIVERSE_CURRENT_CHART)
      return "CURRENT_CHART";
   if(mode == LP_UNIVERSE_FX28)
      return "FX28";
   return "UNKNOWN";
}

string LP_RevmaQProfileName(const int profile)
{
   if(profile == LP_REVMA_Q_PROFILE_FAST)
      return "FAST";
   if(profile == LP_REVMA_Q_PROFILE_MEDIUM)
      return "MEDIUM";
   if(profile == LP_REVMA_Q_PROFILE_SLOW)
      return "SLOW";
   if(profile == LP_REVMA_Q_PROFILE_FULL)
      return "FULL";
   if(profile == LP_REVMA_Q_PROFILE_CUSTOM)
      return "CUSTOM";
   return "UNKNOWN";
}

int LP_RevmaDefaultMaxM1BarsForProfile(const int profile)
{
   if(profile == LP_REVMA_Q_PROFILE_FAST)
      return 5000;
   if(profile == LP_REVMA_Q_PROFILE_MEDIUM)
      return 50000;
   if(profile == LP_REVMA_Q_PROFILE_SLOW)
      return 250000;
   if(profile == LP_REVMA_Q_PROFILE_FULL)
      return 0;
   return 50000;
}

int LP_RevmaResolvedMaxM1Bars(const LP_Config &config)
{
   if(config.revma_q_profile == LP_REVMA_Q_PROFILE_CUSTOM)
      return MathMax(0, config.revma_max_m1_bars);
   return LP_RevmaDefaultMaxM1BarsForProfile(config.revma_q_profile);
}

string LP_RevmaQProfileId(const int profile, const int max_m1_bars)
{
   string name = LP_RevmaQProfileName(profile);
   if(profile == LP_REVMA_Q_PROFILE_FULL || max_m1_bars <= 0)
      return name + "_ALL";
   return name + "_" + IntegerToString(max_m1_bars);
}

string LP_RevmaConfigQProfileId(const LP_Config &config)
{
   static int cached_profile = -999999;
   static int cached_max_m1_bars = -999999;
   static string cached_id = "";

   int max_m1_bars = LP_RevmaResolvedMaxM1Bars(config);
   if(cached_id != "" && cached_profile == config.revma_q_profile && cached_max_m1_bars == max_m1_bars)
      return cached_id;

   cached_profile = config.revma_q_profile;
   cached_max_m1_bars = max_m1_bars;
   cached_id = LP_RevmaQProfileId(config.revma_q_profile, max_m1_bars);
   return cached_id;
}

string LP_RevmaSleeveName(const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_REVERSION)
      return "MEAN_REVERSION";
   return "NONE";
}

double LP_RevmaGridSpacingQForSleeve(const LP_Config &config, const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_NONE)
      return config.revma_grid_spacing_q;
   return config.revma_grid_spacing_q;
}

double LP_RevmaTakeProfitQForSleeve(const LP_Config &config, const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_NONE)
      return config.grid_take_profit_q;
   return config.grid_take_profit_q;
}

double LP_RevmaStopLossQForSleeve(const LP_Config &config, const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_NONE)
      return config.grid_stop_loss_q;
   return config.grid_stop_loss_q;
}

bool LP_RevmaAnySleeveTakeProfitEnabled(const LP_Config &config)
{
   return config.grid_take_profit_q > 0.0;
}

bool LP_RevmaAnySleeveStopTakeProfitEnabled(const LP_Config &config)
{
   return LP_RevmaAnySleeveTakeProfitEnabled(config) ||
      config.grid_stop_loss_q > 0.0;
}

int LP_RevmaVariantForSleeve(const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_REVERSION)
      return LP_VARIANT_REVMA_REVERSION;
   return LP_VARIANT_NONE;
}

ulong LP_RevmaFormulaHash()
{
   static ulong cached_hash = 0;
   if(cached_hash != 0)
      return cached_hash;

   string payload = LP_REVMA_FORMULA_ID;
   payload += "|system_id=" + LP_REVMA_SYSTEM_ID;
   payload += "|pair_direction_formula_id=" + LimniPairDirectionFormulaId();
   payload += "|pair_direction_formula_hash=" + (string)LimniPairDirectionFormulaHash();
   payload += "|gate107a_state_signal_birth_anchor_metadata_only";
   payload += "|birth_context=state_signal_q_anchor_metadata_only";
   payload += "|long_below=adverse_add_lower";
   payload += "|long_above=favorable_add_higher";
   payload += "|short_above=adverse_add_higher";
   payload += "|short_below=favorable_add_lower";
   payload += "|with_trend_states_rejected";
   payload += "|grid_setup_locked_at_birth";
   payload += "|separate_system_no_external_trade_trigger";
   cached_hash = LP_HashString(payload);
   return cached_hash;
}

string LP_RevmaDirectionName(const int direction)
{
   if(direction > 0)
      return "LONG";
   if(direction < 0)
      return "SHORT";
   return "NONE";
}

string LP_RevmaAnchorRelationName(const int anchor_relation)
{
   if(anchor_relation > 0)
      return "ABOVE";
   if(anchor_relation < 0)
      return "BELOW";
   return "AT_OR_UNKNOWN";
}

string LP_RevmaAnchorBucketName(const int direction, const int anchor_relation)
{
   if(direction > 0 && anchor_relation > 0)
      return "LONG_ABOVE_Q_ANCHOR";
   if(direction > 0 && anchor_relation < 0)
      return "LONG_BELOW_Q_ANCHOR";
   if(direction < 0 && anchor_relation > 0)
      return "SHORT_ABOVE_Q_ANCHOR";
   if(direction < 0 && anchor_relation < 0)
      return "SHORT_BELOW_Q_ANCHOR";
   return "UNKNOWN_Q_ANCHOR_LOCATION";
}

string LP_RevmaStochasticBucketName(const double stoch)
{
   if(stoch == EMPTY_VALUE || !MathIsValidNumber(stoch))
      return "STOCH_UNKNOWN";
   if(stoch <= 0.0)
      return "STOCH_0";
   if(stoch < 5.0)
      return "STOCH_0_5";
   if(stoch < 10.0)
      return "STOCH_5_10";
   if(stoch < 20.0)
      return "STOCH_10_20";
   if(stoch < 40.0)
      return "STOCH_20_40";
   if(stoch < 60.0)
      return "STOCH_40_60";
   if(stoch < 80.0)
      return "STOCH_60_80";
   if(stoch < 90.0)
      return "STOCH_80_90";
   if(stoch < 95.0)
      return "STOCH_90_95";
   if(stoch < 100.0)
      return "STOCH_95_100";
   return "STOCH_100";
}

bool LP_RevmaSymbolActive(
   const LP_Config &config,
   const LP_SymbolMeta &meta,
   const string chart_symbol
)
{
   if(config.revma_universe_mode == LP_UNIVERSE_FX28)
      return true;
   return meta.symbol_id == LP_SymbolIdFromBrokerSymbol(chart_symbol);
}

double LP_RevmaPipSize(const LP_SymbolMeta &meta)
{
   double point = meta.point > 0.0 ? meta.point : SymbolInfoDouble(meta.broker_symbol, SYMBOL_POINT);
   int digits = meta.digits > 0 ? meta.digits : (int)SymbolInfoInteger(meta.broker_symbol, SYMBOL_DIGITS);
   if(point <= 0.0)
      return 0.0;
   if(digits == 5 || digits == 3)
      return point * 10.0;
   if(digits == 4 || digits == 2)
      return point;
   double candidate = point * 10.0;
   return candidate > point ? candidate : point;
}

struct LP_RevmaSignal
{
   bool valid;
   bool birth_eligible;
   int symbol_id;
   string symbol;
   datetime source_m1_time;
   int closed_m1_bars;
   int q_days;
   int q_event_count;
   datetime initial_history_boundary;
   ulong reconstruction_epoch;
   int q_profile;
   int max_m1_bars;
   string q_profile_id;
   double price;
   double q;
   double q_pips;
   double anchor;
   double anchor_distance_q;
   double stoch;
   int trend_state;
   int direction;
   int raw_direction;
   int pending_direction;
   int pending_count;
   double raw_score;
   double trend_score;
   double exhaustion_score;
   double confidence;
   int extreme_state;
   int extreme_age_events;
   double max_extension_q;
   bool failed_extension;
   bool stoch_reclaim;
   bool event_momentum_decay;
   int anchor_relation;
   int sleeve;
   int variant_id;
   string system_id;
   string formula_id;
   ulong formula_hash;
   string pair_direction_formula_id;
   ulong pair_direction_formula_hash;
   string reason_code;
};

void LP_ResetRevmaSignal(LP_RevmaSignal &signal)
{
   signal.valid = false;
   signal.birth_eligible = false;
   signal.symbol_id = -1;
   signal.symbol = "";
   signal.source_m1_time = 0;
   signal.closed_m1_bars = 0;
   signal.q_days = 0;
   signal.q_event_count = 0;
   signal.initial_history_boundary = 0;
   signal.reconstruction_epoch = 0;
   signal.q_profile = LP_REVMA_Q_PROFILE_MEDIUM;
   signal.max_m1_bars = 50000;
   signal.q_profile_id = "";
   signal.price = 0.0;
   signal.q = 0.0;
   signal.q_pips = 0.0;
   signal.anchor = 0.0;
   signal.anchor_distance_q = 0.0;
   signal.stoch = EMPTY_VALUE;
   signal.trend_state = 0;
   signal.direction = LP_SIDE_NONE;
   signal.raw_direction = LP_SIDE_NONE;
   signal.pending_direction = LP_SIDE_NONE;
   signal.pending_count = 0;
   signal.raw_score = 0.0;
   signal.trend_score = 0.0;
   signal.exhaustion_score = 0.0;
   signal.confidence = 0.0;
   signal.extreme_state = LIMNI_PAIR_DIRECTION_EXTREME_NONE;
   signal.extreme_age_events = 0;
   signal.max_extension_q = 0.0;
   signal.failed_extension = false;
   signal.stoch_reclaim = false;
   signal.event_momentum_decay = false;
   signal.anchor_relation = 0;
   signal.sleeve = LP_REVMA_SLEEVE_NONE;
   signal.variant_id = LP_VARIANT_NONE;
   signal.system_id = LP_REVMA_SYSTEM_ID;
   signal.formula_id = LP_REVMA_FORMULA_ID;
   signal.formula_hash = LP_RevmaFormulaHash();
   signal.pair_direction_formula_id = LimniPairDirectionFormulaId();
   signal.pair_direction_formula_hash = LimniPairDirectionFormulaHash();
   signal.reason_code = "not_evaluated";
}

bool LP_RevmaClassifySleeve(
   const int direction,
   const double price,
   const double anchor,
   int &anchor_relation,
   int &sleeve
)
{
   anchor_relation = 0;
   sleeve = LP_REVMA_SLEEVE_NONE;
   if(direction == LP_SIDE_NONE || anchor == EMPTY_VALUE || anchor <= 0.0)
      return false;

   if(price > anchor)
      anchor_relation = 1;
   else if(price < anchor)
      anchor_relation = -1;
   else
      anchor_relation = 0;

   sleeve = LP_REVMA_SLEEVE_REVERSION;
   return true;
}

#endif // __LIMNI_PORTFOLIO_REVMA_TYPES_MQH__
