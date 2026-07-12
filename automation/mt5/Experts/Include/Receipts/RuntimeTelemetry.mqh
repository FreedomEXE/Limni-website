/*-----------------------------------------------
  Compact runtime timing telemetry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RUNTIME_TELEMETRY_MQH__
#define __LIMNI_PORTFOLIO_RUNTIME_TELEMETRY_MQH__

#include "ReceiptWriter.mqh"

enum LP_RuntimeMetric
{
   LP_RUNTIME_CLOSED_M1_SCAN = 0,
   LP_RUNTIME_REVMA_SIGNAL_EVALUATION = 1,
   LP_RUNTIME_INVENTORY_REFRESH = 2,
   LP_RUNTIME_RISK_RESERVATION = 3,
   LP_RUNTIME_LIFECYCLE_PERSISTENCE = 4,
   LP_RUNTIME_GRID_CLOSE_EVALUATION = 5,
   LP_RUNTIME_ACCOUNT_CLOSE_EVALUATION = 6,
   LP_RUNTIME_BROKER_TP_SYNC = 7,
   LP_RUNTIME_RECEIPT_FLUSH = 8,
   LP_RUNTIME_METRIC_COUNT = 9
};

class LP_RuntimeTelemetry
{
private:
   ulong m_total_microseconds[LP_RUNTIME_METRIC_COUNT];
   ulong m_max_microseconds[LP_RUNTIME_METRIC_COUNT];
   ulong m_observations[LP_RUNTIME_METRIC_COUNT];

   string MetricName(const int metric)
   {
      if(metric == LP_RUNTIME_CLOSED_M1_SCAN) return "closed_m1_scan";
      if(metric == LP_RUNTIME_REVMA_SIGNAL_EVALUATION) return "revma_signal_evaluation";
      if(metric == LP_RUNTIME_INVENTORY_REFRESH) return "inventory_refresh";
      if(metric == LP_RUNTIME_RISK_RESERVATION) return "risk_reservation";
      if(metric == LP_RUNTIME_LIFECYCLE_PERSISTENCE) return "lifecycle_persistence";
      if(metric == LP_RUNTIME_GRID_CLOSE_EVALUATION) return "grid_close_evaluation";
      if(metric == LP_RUNTIME_ACCOUNT_CLOSE_EVALUATION) return "account_close_evaluation";
      if(metric == LP_RUNTIME_BROKER_TP_SYNC) return "broker_tp_sync";
      if(metric == LP_RUNTIME_RECEIPT_FLUSH) return "receipt_flush";
      return "unknown";
   }

public:
   void Reset()
   {
      for(int i = 0; i < LP_RUNTIME_METRIC_COUNT; i++)
      {
         m_total_microseconds[i] = 0;
         m_max_microseconds[i] = 0;
         m_observations[i] = 0;
      }
   }

   ulong Start()
   {
      return GetMicrosecondCount();
   }

   void ObserveElapsed(const int metric, const ulong started_at)
   {
      if(metric < 0 || metric >= LP_RUNTIME_METRIC_COUNT || started_at == 0)
         return;
      ulong elapsed = GetMicrosecondCount() - started_at;
      m_total_microseconds[metric] += elapsed;
      if(elapsed > m_max_microseconds[metric])
         m_max_microseconds[metric] = elapsed;
      m_observations[metric]++;
   }

   void ObserveValue(const int metric, const ulong elapsed)
   {
      if(metric < 0 || metric >= LP_RUNTIME_METRIC_COUNT)
         return;
      m_total_microseconds[metric] += elapsed;
      if(elapsed > m_max_microseconds[metric])
         m_max_microseconds[metric] = elapsed;
      m_observations[metric]++;
   }

   void ObserveAggregate(const int metric, const ulong observations, const ulong total_microseconds, const ulong max_microseconds)
   {
      if(metric < 0 || metric >= LP_RUNTIME_METRIC_COUNT)
         return;
      m_observations[metric] += observations;
      m_total_microseconds[metric] += total_microseconds;
      if(max_microseconds > m_max_microseconds[metric])
         m_max_microseconds[metric] = max_microseconds;
   }

   void WriteSummary(LP_ReceiptWriter &receipts)
   {
      for(int i = 0; i < LP_RUNTIME_METRIC_COUNT; i++)
      {
         string prefix = "runtime_timing_" + MetricName(i);
         receipts.Summary(prefix + "_observations", (string)m_observations[i]);
         receipts.Summary(prefix + "_total_microseconds", (string)m_total_microseconds[i]);
         receipts.Summary(prefix + "_max_microseconds", (string)m_max_microseconds[i]);
      }
   }
};

#endif // __LIMNI_PORTFOLIO_RUNTIME_TELEMETRY_MQH__
