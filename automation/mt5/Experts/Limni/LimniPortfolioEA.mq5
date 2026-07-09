//+------------------------------------------------------------------+
//|                                             LimniPortfolioEA.mq5 |
//|                  Institutional multi-strategy portfolio shell     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.024"
#property description "LimniPortfolioEA 0.1.24-gate107b-speed2 Revma broker TP speed repair"
#property strict

#include "..\\Include\\Core\\Engine.mqh"

LP_Engine g_engine;

int OnInit()
{
   return g_engine.OnInit();
}

void OnDeinit(const int reason)
{
   g_engine.OnDeinit(reason);
}

void OnTick()
{
   g_engine.OnTick();
}

void OnTimer()
{
   g_engine.OnTimer();
}

void OnTradeTransaction(
   const MqlTradeTransaction &trans,
   const MqlTradeRequest &request,
   const MqlTradeResult &result
)
{
   g_engine.OnTradeTransaction(trans, request, result);
}
//+------------------------------------------------------------------+
