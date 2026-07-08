/*-----------------------------------------------
  Revma v001 system contracts
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_TYPES_MQH__
#define __LIMNI_PORTFOLIO_REVMA_TYPES_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\..\\..\\Indicators\\Include\\LimniPairDirectionCore.mqh"

#define LP_REVMA_SYSTEM_ID "revma-v001"
#define LP_REVMA_SYSTEM_NAME "Revma v001"
#define LP_REVMA_FORMULA_ID "revma-pair-direction-grid-v001"

enum LP_RevmaSleeve
{
   LP_REVMA_SLEEVE_NONE = 0,
   LP_REVMA_SLEEVE_CONTINUATION = 1,
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

string LP_RevmaSleeveModeName(const int mode)
{
   if(mode == LP_REVMA_SLEEVES_TREND_ONLY)
      return "REVMA_TREND_ONLY";
   if(mode == LP_REVMA_SLEEVES_MEAN_REVERSION_ONLY)
      return "REVMA_MEAN_REVERSION_ONLY";
   return "REVMA_TREND_AND_MEAN_REVERSION";
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
   return LP_RevmaQProfileId(config.revma_q_profile, LP_RevmaResolvedMaxM1Bars(config));
}

string LP_RevmaSleeveName(const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_CONTINUATION)
      return "CONTINUATION";
   if(sleeve == LP_REVMA_SLEEVE_REVERSION)
      return "REVERSION";
   return "NONE";
}

int LP_RevmaVariantForSleeve(const int sleeve)
{
   if(sleeve == LP_REVMA_SLEEVE_CONTINUATION)
      return LP_VARIANT_REVMA_CONTINUATION;
   if(sleeve == LP_REVMA_SLEEVE_REVERSION)
      return LP_VARIANT_REVMA_REVERSION;
   return LP_VARIANT_NONE;
}

ulong LP_RevmaFormulaHash()
{
   string payload = LP_REVMA_FORMULA_ID;
   payload += "|system_id=" + LP_REVMA_SYSTEM_ID;
   payload += "|pair_direction_formula_id=" + LimniPairDirectionFormulaId();
   payload += "|pair_direction_formula_hash=" + (string)LimniPairDirectionFormulaHash();
   payload += "|birth_context=direction_plus_anchor_relation";
   payload += "|long_above=continuation_add_higher";
   payload += "|short_below=continuation_add_lower";
   payload += "|long_below=reversion_add_lower";
   payload += "|short_above=reversion_add_higher";
   payload += "|grid_sleeve_locked_at_birth";
   payload += "|separate_system_no_external_trade_trigger";
   return LP_HashString(payload);
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
   int symbol_id;
   string symbol;
   datetime source_m1_time;
   int closed_m1_bars;
   int q_days;
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
   signal.symbol_id = -1;
   signal.symbol = "";
   signal.source_m1_time = 0;
   signal.closed_m1_bars = 0;
   signal.q_days = 0;
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

   if(anchor_relation == 0)
      return false;

   bool continuation = (direction > 0 && anchor_relation > 0) ||
      (direction < 0 && anchor_relation < 0);
   sleeve = continuation ? LP_REVMA_SLEEVE_CONTINUATION : LP_REVMA_SLEEVE_REVERSION;
   return true;
}

#endif // __LIMNI_PORTFOLIO_REVMA_TYPES_MQH__
