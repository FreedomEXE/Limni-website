/*-----------------------------------------------
  Magic/comment encoding owned by execution layer
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__
#define __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__

#include "..\\Core\\BuildInfo.mqh"
#include "..\\Core\\Types.mqh"

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

string LP_BuildComment(const string canonical_symbol, const int lane_id, const int variant_id, const int direction, const ulong config_hash)
{
   string side = direction > 0 ? "B" : (direction < 0 ? "S" : "N");
   return "LMN1|" + canonical_symbol + "|L" + IntegerToString(lane_id) +
      "|V" + IntegerToString(variant_id) +
      "|" + side +
      "|C" + StringSubstr((string)config_hash, 0, 6);
}

#endif // __LIMNI_PORTFOLIO_MAGIC_CODEC_MQH__
