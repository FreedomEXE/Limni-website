/*-----------------------------------------------
  Strategy registry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
#define __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__

#include "..\\Core\\Types.mqh"
#include "IntentBus.mqh"
#include "Revma\\RevmaGridSleeve.mqh"

class LP_StrategyRegistry
{
private:
   LP_RevmaGridSleeve m_revma;
   bool m_enabled;

public:
   bool CanReset()
   {
      return m_revma.CanResetDiscoveryForNewRun();
   }

   bool Reset()
   {
      if(!CanReset())
         return false;
      m_enabled = false;
      return m_revma.Reset();
   }

   void SetEnabled(const bool enabled)
   {
      m_enabled = enabled;
   }

   void Configure(const ulong config_hash, const LP_Config &config)
   {
      m_revma.Configure(config_hash, config);
   }

   bool InitializeRevmaDiscovery(
      const LP_Config &config,
      const string run_id,
      const long equity_reference_minor,
      const double money_quantum
   )
   {
      return m_revma.InitializeDiscovery(
         config, run_id, equity_reference_minor, money_quantum);
   }

   bool FinalizeRevmaDiscovery()
   {
      return m_revma.FinalizeDiscovery();
   }

   bool ReconcileRevmaDiscoveryRealConfirmedFlat(
      LP_GridBook &grid_book,
      const long actual_account_equity_minor)
   {
      return m_revma.ReconcileDiscoveryRealConfirmedFlat(grid_book,
         actual_account_equity_minor);
   }

   int ContinueRevmaDiscoveryRealCloses(
      LP_GridBook &grid_book,
      LP_IntentBus &bus)
   {
      if(!m_enabled)
         return 0;
      return m_revma.ContinueDiscoveryRealCloses(grid_book, bus, 0);
   }

   int ProcessRevmaDiscoveryCompletedM1Batch(
      LP_RevmaCompletedM1Snapshot &snapshots[],
      const int snapshot_count,
      LP_GridBook &grid_book,
      LP_IntentBus &bus)
   {
      if(!m_enabled)
         return 0;
      return m_revma.ProcessDiscoveryCompletedM1Batch(
         snapshots, snapshot_count, grid_book, bus);
   }

   bool EndRevmaDiscoveryRealBatch()
   {
      return m_revma.EndDiscoveryRealBatch();
   }

   bool AuthorizeRevmaDiscoveryRealIntentBeforeRoute(
      const LP_TradeIntent &intent,
      bool &authorized)
   {
      return m_revma.AuthorizeDiscoveryRealIntentBeforeRoute(intent,
         authorized);
   }

   bool RevmaDiscoveryTelemetryValid()
   {
      return m_revma.DiscoveryTelemetryValid();
   }

   string RevmaDiscoveryTelemetryInvalidReason()
   {
      return m_revma.DiscoveryTelemetryInvalidReason();
   }

   bool RevmaDiscoveryInitialized()
   {
      return m_revma.DiscoveryInitialized();
   }

   bool RevmaDiscoveryFaultLatched()
   {
      return m_revma.DiscoveryFaultLatched();
   }

   bool RevmaDiscoveryOperationalValid()
   {
      return m_revma.DiscoveryOperationalValid();
   }

   bool RevmaDiscoveryCompletionValid()
   {
      return m_revma.DiscoveryCompletionValid();
   }

   void InvalidateRevmaDiscovery(const string reason)
   {
      m_revma.InvalidateDiscovery(reason);
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

   void FinalizeRevmaResearchTelemetry(
      const LP_Config &config,
      const LP_BrokerExecutionIntegrity &broker_integrity,
      LP_ReceiptWriter &receipts
   )
   {
      m_revma.FinalizeResearchTelemetry(config, broker_integrity, receipts);
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

   bool RecordRevmaRiskDecision(
      const LP_TradeIntent &intent,
      const LP_RiskDecision &decision,
      LP_ReceiptWriter &receipts
   )
   {
      return m_revma.RecordRiskDecision(intent, decision, receipts);
   }

   bool RecordRevmaExecutionOutcome(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      return m_revma.RecordExecutionOutcome(plan, execution, receipts);
   }

   bool RecordRevmaCloseExecution(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      return m_revma.RecordCloseExecution(plan, execution, receipts);
   }

   bool HasLatchedRevmaGridClose()
   {
      return m_revma.HasLatchedGridClose();
   }

};

#endif // __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
