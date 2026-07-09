/*-----------------------------------------------
  Strategy registry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
#define __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__

#include "..\\Core\\Types.mqh"
#include "IntentBus.mqh"
#include "TrendFollowLane.mqh"
#include "ReversalLane.mqh"
#include "RevmaGridSleeve.mqh"

class LP_StrategyRegistry
{
private:
   LP_TrendFollowLane m_trend_follow;
   LP_ReversalLane m_reversal;
   LP_RevmaGridSleeve m_revma;
   bool m_enabled;

public:
   void Reset()
   {
      m_enabled = false;
      m_trend_follow.Reset();
      m_reversal.Reset();
      m_revma.Reset();
   }

   void SetEnabled(const bool enabled)
   {
      m_enabled = enabled;
   }

   void Configure(const ulong config_hash, const LP_Config &config)
   {
      m_trend_follow.Configure(config_hash);
      m_revma.Configure(config_hash, config);
   }

   int LoadRevmaGridState(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      return m_revma.LoadPersistedBirths(grid_book, receipts);
   }

   int CleanupRevmaGridState(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      return m_revma.CleanupClosedBirths(grid_book, receipts);
   }

   void ObserveRevmaGridPath(LP_GridBook &grid_book)
   {
      m_revma.ObserveGridPath(grid_book);
   }

   void FinalizeRevmaResearchTelemetry(const LP_Config &config, LP_ReceiptWriter &receipts)
   {
      m_revma.FinalizeResearchTelemetry(config, receipts);
   }

   ulong RevmaLifecyclePersistenceWriteCount()
   {
      return m_revma.LifecyclePersistenceWriteCount();
   }

   ulong RevmaLifecyclePersistenceTotalMicroseconds()
   {
      return m_revma.LifecyclePersistenceTotalMicroseconds();
   }

   ulong RevmaLifecyclePersistenceMaxMicroseconds()
   {
      return m_revma.LifecyclePersistenceMaxMicroseconds();
   }

   int EvaluateRevma(
      const LP_RevmaSignal &signal,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus,
      const bool birth_allowed
   )
   {
      if(!m_enabled)
         return 0;
      return m_revma.Evaluate(signal, config, grid_book, receipts, bus, birth_allowed);
   }

   int EvaluateRevmaGridExits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(!m_enabled)
         return 0;
      return m_revma.EvaluateGridExits(config, grid_book, receipts, bus);
   }

   int SyncRevmaGridTakeProfits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(!m_enabled)
         return 0;
      return m_revma.SyncGridTakeProfits(config, grid_book, receipts, bus);
   }

   string RevmaVisualDashboardText()
   {
      return m_revma.VisualDashboardText();
   }

   double RevmaVisualCenterlinePrice()
   {
      return m_revma.VisualDashboardCenterlinePrice();
   }

   bool ConsumeRevmaDashboardScreenshotRequest()
   {
      return m_revma.ConsumeDashboardScreenshotRequest();
   }

   ulong RevmaBrokerTpSyncTicketScanCount()
   {
      return m_revma.BrokerTpSyncTicketScanCount();
   }

   void RecordRevmaRiskDecision(
      const LP_TradeIntent &intent,
      const LP_RiskDecision &decision,
      LP_ReceiptWriter &receipts
   )
   {
      m_revma.RecordRiskDecision(intent, decision, receipts);
   }

   void RecordRevmaExecutionOutcome(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      m_revma.RecordExecutionOutcome(plan, execution, receipts);
   }

   void RecordRevmaCloseExecution(const LP_TradePlan &plan, const LP_TradeExecutionResult &execution)
   {
      m_revma.RecordCloseExecution(plan, execution);
   }

   int EvaluateAll(
      const LP_SignalSnapshot &snapshot,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_IntentBus &bus
   )
   {
      if(!m_enabled)
         return 0;

      if(!config.enable_qstate_trend_variant)
         return 0;

      int emitted = 0;
      emitted += m_trend_follow.Evaluate(snapshot, config, grid_book, bus);
      emitted += m_reversal.Evaluate(snapshot, bus);
      return emitted;
   }
};

#endif // __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
