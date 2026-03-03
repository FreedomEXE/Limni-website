/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
-- File: 014_mt5_kill_switch_and_risk_events.sql
-- Description: MT5 kill-switch, risk events, and heartbeat architecture tables.
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

CREATE TABLE IF NOT EXISTS mt5_kill_switches (
  account_id VARCHAR(50) PRIMARY KEY,
  halt BOOLEAN NOT NULL DEFAULT FALSE,
  liquidate BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL DEFAULT '',
  issued_by VARCHAR(100) NOT NULL DEFAULT 'system',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt5_risk_events (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mt5_risk_events_account ON mt5_risk_events(account_id);
CREATE INDEX IF NOT EXISTS idx_mt5_risk_events_type ON mt5_risk_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mt5_risk_events_created ON mt5_risk_events(created_at);

CREATE TABLE IF NOT EXISTS mt5_heartbeats (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(50) NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  ea_version VARCHAR(20) NOT NULL,
  state VARCHAR(20) NOT NULL,
  open_positions INT NOT NULL DEFAULT 0,
  basket_pnl_pct DECIMAL(10,4) DEFAULT 0,
  equity DECIMAL(15,2) DEFAULT 0,
  errors_last_hour INT NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mt5_heartbeats_account ON mt5_heartbeats(account_id);
CREATE INDEX IF NOT EXISTS idx_mt5_heartbeats_ts ON mt5_heartbeats(ts_utc);

-- Retention policy:
-- Heartbeats older than 30 days may be archived to cold storage.
