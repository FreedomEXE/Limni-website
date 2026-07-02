//+------------------------------------------------------------------+
//|                         LimniBasketHedgeEAAlphaV3.mq5            |
//|                 Alpha V3 raw no-boundary harvest engine          |
//+------------------------------------------------------------------+
#property strict
#property version "3.000"

#include <Trade/Trade.mqh>

enum RawHarvestTesterCadence
{
  RH_CADENCE_EVERY_TICK = 0,
  RH_CADENCE_NEW_M1_BAR = 1,
  RH_CADENCE_NEW_M5_BAR = 5
};

input string SymbolsCsv = "";
input bool UseCurrentChartSymbolOnly = true;
input double LotSize = 0.01;
input double AdrValue = 0.0;
input int AdrLookbackDays = 14;
input int AdrRefreshSeconds = 3600;
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
input RawHarvestTesterCadence TesterCadence = RH_CADENCE_EVERY_TICK;
input int TesterMinSecondsBetweenManage = 0;
input int DrawdownRefreshSeconds = 60;
input bool EquityHwmResetEnabled = false;
input double EquityHwmResetTargetMoney = 500.0;
input int EquityHwmResetCooldownSeconds = 60;
input bool EquityHwmCsvLogEnabled = true;
input bool EquityLwmResetEnabled = false;
input double EquityLwmLossLimitMoney = 500.0;
input int EquityLwmResetCooldownSeconds = 60;
input bool MaxAgeResetEnabled = false;
input int MaxAgeDays = 30;
input bool EquityTrailLockEnabled = false;
input double EquityTrailActivationMoney = 250.0;
input double EquityTrailGivebackMoney = 100.0;
input bool EquityTrailUnlockWhenFlat = true;

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
