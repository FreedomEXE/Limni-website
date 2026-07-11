//+------------------------------------------------------------------+
//|                                             LimniPortfolioEA.mq5 |
//|                  Institutional multi-strategy portfolio shell     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.031"
#property description "Limni Portfolio EA modular multi-system portfolio shell"
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
