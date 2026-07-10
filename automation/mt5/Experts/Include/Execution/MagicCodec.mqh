/*-----------------------------------------------
  Magic/comment encoding owned by execution layer
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__
#define __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__

#include "..\\Core\\BuildInfo.mqh"
#include "..\\Core\\Types.mqh"

struct LP_MagicParts
{
   bool valid;
   int major_version;
   int symbol_id;
   int lane_id;
   int variant_id;
   int direction;
   int grid_family;
};

void LP_ResetMagicParts(LP_MagicParts &parts)
{
   parts.valid = false;
   parts.major_version = 0;
   parts.symbol_id = -1;
   parts.lane_id = LP_LANE_NONE;
   parts.variant_id = LP_VARIANT_NONE;
   parts.direction = LP_SIDE_NONE;
   parts.grid_family = 0;
}

long LP_BuildMagic(const int symbol_id, const int lane_id, const int variant_id, const int direction, const int grid_family)
{
   int direction_code = direction > 0 ? 1 : (direction < 0 ? 2 : 0);
   return LP_MAGIC_BASE +
      (long)LP_MAGIC_MAJOR_VERSION * 1000000000000 +
      (long)MathMax(0, symbol_id) * 1000000000 +
      (long)MathMax(0, lane_id) * 10000000 +
      (long)MathMax(0, variant_id) * 100000 +
      (long)direction_code * 10000 +
      (long)MathMax(0, grid_family);
}

bool LP_IsLimniMagicNamespace(const long magic)
{
   const long minimum_magic = LP_MAGIC_BASE + (long)LP_MAGIC_MAJOR_VERSION * 1000000000000;
   const long maximum_magic = LP_MAGIC_BASE + (long)(LP_MAGIC_MAJOR_VERSION + 1) * 1000000000000;
   return magic >= minimum_magic && magic < maximum_magic;
}

bool LP_IsSupportedMagicLaneVariant(const int lane_id, const int variant_id)
{
   // Only identities emitted by the active portfolio executor are owned.
   // Enum-range acceptance is deliberately not enough: a future or malformed
   // lane must stay external until its concrete contract is implemented.
   return (lane_id == LP_LANE_REVMA && variant_id == LP_VARIANT_REVMA_REVERSION) ||
      (lane_id == LP_LANE_TREND_FOLLOW && variant_id == LP_VARIANT_STRICT);
}

bool LP_DecodeMagic(const long magic, LP_MagicParts &parts)
{
   LP_ResetMagicParts(parts);
   if(!LP_IsLimniMagicNamespace(magic))
      return false;

   long offset = magic - LP_MAGIC_BASE;
   const long major_unit = 1000000000000;
   const long symbol_unit = 1000000000;
   const long lane_unit = 10000000;
   const long variant_unit = 100000;
   const long direction_unit = 10000;

   parts.major_version = (int)(offset / major_unit);
   long rem = offset % major_unit;
   parts.symbol_id = (int)(rem / symbol_unit);
   rem = rem % symbol_unit;
   parts.lane_id = (int)(rem / lane_unit);
   rem = rem % lane_unit;
   parts.variant_id = (int)(rem / variant_unit);
   rem = rem % variant_unit;
   int direction_code = (int)(rem / direction_unit);
   rem = rem % direction_unit;
   parts.grid_family = (int)rem;

   if(direction_code == 1)
      parts.direction = LP_SIDE_LONG;
   else if(direction_code == 2)
      parts.direction = LP_SIDE_SHORT;
   else
      parts.direction = LP_SIDE_NONE;

    parts.valid = parts.major_version == LP_MAGIC_MAJOR_VERSION &&
       parts.symbol_id >= 0 &&
       parts.symbol_id < LP_SYMBOL_COUNT &&
       LP_IsSupportedMagicLaneVariant(parts.lane_id, parts.variant_id) &&
       direction_code >= 1 &&
       direction_code <= 2 &&
       parts.grid_family > 0;
   return parts.valid;
}

bool LP_IsManagedMagic(const long magic)
{
   LP_MagicParts parts;
   return LP_DecodeMagic(magic, parts);
}

ulong LP_BuildGridKey(
   const int symbol_id,
   const int lane_id,
   const int variant_id,
   const int direction,
   const int grid_family
)
{
   int direction_code = direction > 0 ? 1 : (direction < 0 ? 2 : 0);
   return (ulong)MathMax(0, symbol_id) * 1000000000 +
      (ulong)MathMax(0, lane_id) * 10000000 +
      (ulong)MathMax(0, variant_id) * 100000 +
      (ulong)direction_code * 10000 +
      (ulong)MathMax(0, grid_family);
}

ulong LP_BuildGridKeyFromParts(const LP_MagicParts &parts)
{
   return LP_BuildGridKey(parts.symbol_id, parts.lane_id, parts.variant_id, parts.direction, parts.grid_family);
}

bool LP_ResolveIntentGridIdentity(
   const LP_TradeIntent &intent,
   ulong &resolved_grid_key,
   int &resolved_grid_family,
   string &reason
)
{
   resolved_grid_key = 0;
   resolved_grid_family = 0;
   reason = "";

   if(intent.action == LP_INTENT_CLOSE_ALL_EA)
   {
      reason = "grid_identity_not_applicable";
      return true;
   }

   bool grid_action = intent.action == LP_INTENT_OPEN_GRID ||
      intent.action == LP_INTENT_ADD_GRID_LEG ||
      intent.action == LP_INTENT_REDUCE_GRID ||
      intent.action == LP_INTENT_CLOSE_GRID ||
      intent.action == LP_INTENT_SYNC_GRID_TP;
   if(!grid_action)
   {
      reason = "grid_identity_action_unsupported";
      return false;
   }

   if(intent.grid_key > 0)
      resolved_grid_family = (int)(intent.grid_key % 10000);
   else if(intent.action == LP_INTENT_OPEN_GRID && intent.intent_id > 0)
      resolved_grid_family = (int)(intent.intent_id % 9000) + 1;
   else
   {
      reason = "grid_identity_missing";
      return false;
   }

   if(resolved_grid_family <= 0 || resolved_grid_family > 9999)
   {
      reason = "grid_family_out_of_range";
      return false;
   }

   resolved_grid_key = LP_BuildGridKey(
      intent.symbol_id,
      intent.lane_id,
      intent.variant_id,
      intent.direction,
      resolved_grid_family
   );
   if(intent.grid_key > 0 && intent.grid_key != resolved_grid_key)
   {
      reason = "grid_identity_fields_mismatch|supplied_grid_key=" +
         (string)intent.grid_key +
         "|resolved_grid_key=" + (string)resolved_grid_key;
      resolved_grid_key = 0;
      resolved_grid_family = 0;
      return false;
   }

   reason = intent.grid_key > 0 ? "grid_identity_supplied_valid" :
      "grid_identity_derived_for_open";
   return true;
}

string LP_StrategyCommentName(const int lane_id, const int variant_id)
{
   if(lane_id == LP_LANE_REVMA)
   {
      if(variant_id == LP_VARIANT_REVMA_REVERSION)
         return "RevmaMeanRev";
      return "Revma";
   }
   if(lane_id == LP_LANE_TREND_FOLLOW)
      return "TrendFollow";
   if(lane_id == LP_LANE_REVERSAL)
      return "Reversal";
   return "Limni";
}

string LP_TradeSideCommentName(const int direction)
{
   if(direction > 0)
      return "BUY";
   if(direction < 0)
      return "SELL";
   return "NONE";
}

string LP_BuildComment(const string canonical_symbol, const int lane_id, const int variant_id, const int direction, const ulong config_hash)
{
   string readable = LP_StrategyCommentName(lane_id, variant_id) + " " +
      LP_TradeSideCommentName(direction) + " " +
      canonical_symbol;
   string suffix = " C" + StringSubstr((string)config_hash, 0, 4);
   string comment = readable + suffix;

   if(StringLen(comment) <= 31)
      return comment;

   string compact_symbol = StringLen(canonical_symbol) > 6 ? StringSubstr(canonical_symbol, 0, 6) : canonical_symbol;
   comment = LP_StrategyCommentName(lane_id, variant_id) + " " +
      (direction > 0 ? "B" : (direction < 0 ? "S" : "N")) + " " +
      compact_symbol + suffix;
   if(StringLen(comment) <= 31)
      return comment;

   return StringSubstr(comment, 0, 31);
}

#endif // __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__
