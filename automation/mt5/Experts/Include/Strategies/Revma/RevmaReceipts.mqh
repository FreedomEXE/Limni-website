/*-----------------------------------------------
  Revma receipt helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_RECEIPTS_MQH__
#define __LIMNI_PORTFOLIO_REVMA_RECEIPTS_MQH__

#include "..\\..\\Receipts\\ReceiptWriter.mqh"
#include "..\\RevmaTypes.mqh"

void LP_WriteRevmaSignalReceipt(
   LP_ReceiptWriter &receipts,
   const LP_RevmaSignal &signal,
   const string status,
   const string detail,
   const int emitted
)
{
   receipts.Write(
      LP_RECEIPT_REVMA_SIGNAL,
      signal.symbol,
      status,
      "system_id=" + LP_REVMA_SYSTEM_ID +
         "|system_name=" + LP_REVMA_SYSTEM_NAME +
         "|formula_id=" + LP_REVMA_FORMULA_ID +
         "|formula_hash=" + (string)signal.formula_hash +
         "|pair_direction_formula_id=" + LimniPairDirectionFormulaId() +
         "|pair_direction_formula_hash=" + (string)LimniPairDirectionFormulaHash() +
         "|source_m1_time=" + LP_Stamp(signal.source_m1_time) +
         "|q_profile=" + LP_RevmaQProfileName(signal.q_profile) +
         "|max_m1_bars=" + IntegerToString(signal.max_m1_bars) +
         "|q_profile_id=" + signal.q_profile_id +
         "|direction=" + LP_RevmaDirectionName(signal.direction) +
         "|sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
         "|anchor_relation=" + LP_RevmaAnchorRelationName(signal.anchor_relation) +
         "|q=" + DoubleToString(signal.q, 8) +
         "|q_pips=" + DoubleToString(signal.q_pips, 2) +
         "|anchor=" + DoubleToString(signal.anchor, 5) +
         "|stochastic=" + DoubleToString(signal.stoch, 2) +
         "|raw_score=" + DoubleToString(signal.raw_score, 6) +
         "|q_days=" + IntegerToString(signal.q_days) +
         "|closed_m1_bars=" + IntegerToString(signal.closed_m1_bars) +
         "|emitted=" + IntegerToString(emitted) +
         "|detail=" + detail,
      LP_LANE_REVMA,
      signal.variant_id,
      signal.formula_hash,
      0,
      0,
      0
   );
}

#endif // __LIMNI_PORTFOLIO_REVMA_RECEIPTS_MQH__
