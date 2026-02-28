/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Automation bots landing page with status cards and navigation into
 * dedicated monitoring views, including Bitget Bot v2 dashboard.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import AutomationSectionCards from "@/components/automation/AutomationSectionCards";
import AutomationBotsCards from "@/components/automation/AutomationBotsCards";
import { readBotState } from "@/lib/botState";
import { readMt5Accounts } from "@/lib/mt5Store";

export const dynamic = "force-dynamic";

type BotStatus = "ON" | "OFF" | "WAITING" | "READY" | "WATCHING" | "ERROR";

type BotBadge = {
  label: BotStatus;
  tone: string;
};

function statusBadge(status: BotStatus): BotBadge {
  switch (status) {
    case "ON":
      return {
        label: "ON",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };
    case "READY":
      return {
        label: "READY",
        tone: "border-sky-200 bg-sky-50 text-sky-800",
      };
    case "WATCHING":
      return {
        label: "WATCHING",
        tone: "border-amber-200 bg-amber-50 text-amber-800",
      };
    case "ERROR":
      return {
        label: "ERROR",
        tone: "border-rose-200 bg-rose-50 text-rose-800",
      };
    case "WAITING":
      return {
        label: "WAITING",
        tone: "border-amber-200 bg-amber-50 text-amber-800",
      };
    default:
      return {
        label: "OFF",
        tone: "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]",
      };
  }
}

function isFresh(iso: string | null | undefined, minutes = 10) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= minutes * 60 * 1000;
}

export default async function AutomationBotsPage() {
  const [mt5Accounts, bitgetState, kataraktiState] = await Promise.all([
    readMt5Accounts().catch(() => []),
    readBotState("bitget_perp_v2"),
    readBotState("katarakti_v1"),
  ]);

  const mt5Fresh = mt5Accounts.some((account) => isFresh(account.last_sync_utc, 15));
  const mt5Status: BotStatus = mt5Accounts.length === 0 ? "OFF" : mt5Fresh ? "ON" : "OFF";
  const bitgetLifecycle = String((bitgetState?.state as { lifecycle?: string } | undefined)?.lifecycle ?? "");
  const bitgetStatus: BotStatus =
    !bitgetState || bitgetLifecycle === "" || bitgetLifecycle === "IDLE" || bitgetLifecycle === "KILLED"
      ? "OFF"
      : ["POSITION_OPEN", "SCALING", "TRAILING"].includes(bitgetLifecycle)
        ? "ON"
        : ["WATCHING_SWEEP", "WATCHING_RANGE", "AWAITING_HANDSHAKE", "WEEK_READY"].includes(bitgetLifecycle)
          ? "WATCHING"
          : bitgetLifecycle === "ERROR"
            ? "ERROR"
            : "OFF";
  const kataraktiLifecycle = String((kataraktiState?.state as { lifecycle?: string } | undefined)?.lifecycle ?? "");
  const kataraktiStatus: BotStatus =
    !kataraktiState || kataraktiLifecycle === "" || kataraktiLifecycle === "IDLE" || kataraktiLifecycle === "KILLED"
      ? "OFF"
      : ["POSITION_OPEN", "TRAILING"].includes(kataraktiLifecycle)
        ? "ON"
        : ["SCANNING", "WEEK_READY"].includes(kataraktiLifecycle)
          ? "WATCHING"
          : kataraktiLifecycle === "ERROR"
            ? "ERROR"
            : "OFF";
  const mt5Badge = statusBadge(mt5Status);
  const bitgetBadge = statusBadge(bitgetStatus);
  const kataraktiBadge = statusBadge(kataraktiStatus);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <AutomationSectionCards active="bots" />
        <AutomationBotsCards active="overview" />

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Bots
          </h1>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                MT5 Forex Basket EA
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${mt5Badge.tone}`}>
                {mt5Badge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Production-ready EA with weekly basket logic.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>ATR-weighted sizing</span>
              <span>Global equity trail</span>
            </div>
          </div>

          <Link
            href="/automation/bots/bitget"
            className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Crypto Perp Bot (Bitget)
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bitgetBadge.tone}`}>
                {bitgetBadge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              BTC/ETH perp automation with unified signal alignment.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>10x leverage, unlevered trail</span>
              <span>All-model alignment filter</span>
            </div>
          </Link>

          <Link
            href="/automation/bots/mt5-forex"
            className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Katarakti (MT5 Forex)
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${kataraktiBadge.tone}`}>
                {kataraktiBadge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Individual pair sweep entries across 36 FX, index, and commodity instruments.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>Tiered bias sizing (T1/T2)</span>
              <span>Stepped stop management</span>
            </div>
          </Link>

          <Link
            href="/automation/solana-meme-bot"
            className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Solana Meme Bot
              </h2>
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                Tracking
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              High-volatility meme strategy targeting Solana launches.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--foreground)]/70">
              <span>Recoup + moonbag logic</span>
              <span>Live signal stream</span>
            </div>
          </Link>
        </section>
      </div>
    </DashboardLayout>
  );
}
