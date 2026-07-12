/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
#ifndef __LIMNI_MODELS_MQH__
#define __LIMNI_MODELS_MQH__

#include "Enums.mqh"

struct SymbolStats
{
  double volume;
  double avg_price;
  int direction;
  datetime last_open;
  bool valid;
};

struct LegSizingResult
{
  bool ok;
  string reasonKey;
  string profile;
  string toleranceMode;
  double targetLot;
  double solvedLotRaw;
  double postClampLot;
  double finalLot;
  double deviationPct;
  double equityPerSymbol;
  double targetRiskUsd;
  double marginRequired;
  double move1pctUsd;
  double move1pctPerLotUsd;
  double move1pctCapUsd;
  double specPrice;
  double specTickSize;
  double specTickValue;
  double specContractSize;
  double specMinLot;
  double specMaxLot;
  double specLotStep;
};

struct SymbolSpecProbe
{
  bool ok;
  string reason;
  double price;
  double bid;
  double ask;
  double last;
  double point;
  double tickSize;
  double tickValue;
  double tickValueProfit;
  double tickValueLoss;
  double contractSize;
  double minLot;
  double maxLot;
  double lotStep;
  int volumeDigits;
  int digits;
  int tradeMode;
  double move1pctPerLotUsd;
};

struct SizingPolicy
{
  string profile;
  double riskScale;
  double moveCapUsd;
  bool strictUnderTarget;
  double maxOvershootPct;
};

struct ClosedPositionCache
{
  string symbol;
  int direction;
  string model;
  string assetClass;
};

#endif // __LIMNI_MODELS_MQH__
