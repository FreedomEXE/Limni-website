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

bool LP_IsManagedMagic(const long magic)
{
   return magic >= LP_MAGIC_BASE && magic < LP_MAGIC_BASE + 100000000000000;
}

bool LP_DecodeMagic(const long magic, LP_MagicParts &parts)
{
   LP_ResetMagicParts(parts);
   if(!LP_IsManagedMagic(magic))
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
      direction_code >= 0 &&
      direction_code <= 2;
   return parts.valid;
}

string LP_BuildComment(const string canonical_symbol, const int lane_id, const int variant_id, const int direction, const ulong config_hash)
{
   string side = direction > 0 ? "B" : (direction < 0 ? "S" : "N");
   return "LMN1|" + canonical_symbol + "|L" + IntegerToString(lane_id) +
      "|V" + IntegerToString(variant_id) +
      "|" + side +
      "|C" + StringSubstr((string)config_hash, 0, 6);
}

#endif // __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__
