//+------------------------------------------------------------------+
//|                         LimniBasketHedgeEAAlphaV3.mq5            |
//|                 Alpha V3 raw no-boundary harvest engine          |
//+------------------------------------------------------------------+
#property strict
#property version "3.000"

#include <Trade/Trade.mqh>

input string SymbolsCsv = "";
input bool UseCurrentChartSymbolOnly = true;
input double LotSize = 0.01;
input double AdrValue = 0.0;
input int AdrLookbackDays = 14;
input double TargetAdrMultiple = 1.0;
input double SpacingAdrMultiple = 0.2;
input int MaxPositionsPerSymbol = 250;
input bool EnableTrading = true;
input bool AllowLiveTrading = false;
input bool ManualFlattenNow = false;
input long MagicNumberBase = 840840;
input int SlippagePoints = 10;
input int MaxOrdersPerTick = 50;
input bool CsvLogEnabled = true;
input bool DashboardEnabled = true;
input int DashboardRefreshSeconds = 10;
input int DashboardMaxSymbols = 8;
input bool EnableTimer = false;
input int TimerSeconds = 1;

#include "Include/Strategy/RawHarvestEngine.mqh"

int OnInit()
{
  return RH_OnInit();
}

void OnDeinit(const int reason)
{
  RH_OnDeinit();
}

void OnTick()
{
  RH_ManageAllSymbols();
}

void OnTimer()
{
  RH_ManageAllSymbols();
}
