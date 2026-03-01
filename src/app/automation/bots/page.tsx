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
  const [mt5Accounts, bitgetState, bitgetLiteState, kataraktiState, kataraktiLiteState] = await Promise.all([
    readMt5Accounts().catch(() => []),
    readBotState("bitget_perp_v2"),
    readBotState("katarakti_crypto_lite"),
    readBotState("katarakti_v1"),
    readBotState("katarakti_cfd_lite"),
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
  const bitgetLiteLifecycle = String((bitgetLiteState?.state as { lifecycle?: string } | undefined)?.lifecycle ?? "");
  const bitgetLiteStatus: BotStatus =
    !bitgetLiteState || bitgetLiteLifecycle === "" || bitgetLiteLifecycle === "IDLE" || bitgetLiteLifecycle === "KILLED"
      ? "OFF"
      : ["POSITION_OPEN", "SCALING", "TRAILING"].includes(bitgetLiteLifecycle)
        ? "ON"
        : ["WATCHING_SWEEP", "WATCHING_RANGE", "AWAITING_HANDSHAKE", "WEEK_READY"].includes(bitgetLiteLifecycle)
          ? "WATCHING"
          : bitgetLiteLifecycle === "ERROR"
            ? "ERROR"
            : "OFF";
  const kataraktiLiteLifecycle = String((kataraktiLiteState?.state as { lifecycle?: string } | undefined)?.lifecycle ?? "");
  const kataraktiLiteStatus: BotStatus =
    !kataraktiLiteState || kataraktiLiteLifecycle === "" || kataraktiLiteLifecycle === "IDLE" || kataraktiLiteLifecycle === "KILLED"
      ? "OFF"
      : ["POSITION_OPEN", "TRAILING"].includes(kataraktiLiteLifecycle)
        ? "ON"
        : ["SCANNING", "WEEK_READY"].includes(kataraktiLiteLifecycle)
          ? "WATCHING"
          : kataraktiLiteLifecycle === "ERROR"
            ? "ERROR"
            : "OFF";
  const mt5Badge = statusBadge(mt5Status);
  const bitgetBadge = statusBadge(bitgetStatus);
  const kataraktiBadge = statusBadge(kataraktiStatus);
  const bitgetLiteBadge = statusBadge(bitgetLiteStatus);
  const kataraktiLiteBadge = statusBadge(kataraktiLiteStatus);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Bots
          </h1>
        </header>

        <AutomationBotsCards active="overview" />

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Crypto Systems
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Core vs Lite
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/automation/bots/bitget"
                className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">
                    Katarakti (Crypto)
                  </h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bitgetBadge.tone}`}>
                    {bitgetBadge.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Crypto futures sweep entries with unified signal alignment.
                </p>
                <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
                  <span>10x leverage, unlevered trail</span>
                  <span>All-model alignment filter</span>
                </div>
              </Link>

              <Link
                href="/automation/bots/bitget-lite"
                className="rounded-2xl border border-sky-300/30 bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                      Katarakti Crypto Lite
                    </h3>
                    <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-200">
                      Lite
                    </span>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bitgetLiteBadge.tone}`}>
                    {bitgetLiteBadge.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Simplified sustained-deviation entries for side-by-side live comparison.
                </p>
                <div className="mt-4 grid gap-2 text-xs text-sky-200/80">
                  <span>No handshake requirement</span>
                  <span>Weekly bias filter retained</span>
                </div>
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                CFD Systems
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Core vs Lite
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/automation/bots/mt5-forex"
                className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">
                    Katarakti (CFD)
                  </h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${kataraktiBadge.tone}`}>
                    {kataraktiBadge.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Individual pair sweep entries across FX, index, and commodity instruments.
                </p>
                <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
                  <span>Tiered bias sizing (T1/T2)</span>
                  <span>Stepped stop management</span>
                </div>
              </Link>

              <Link
                href="/automation/bots/mt5-forex-lite"
                className="rounded-2xl border border-teal-300/30 bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                      Katarakti CFD Lite
                    </h3>
                    <span className="rounded-full border border-teal-300/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-200">
                      Lite
                    </span>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${kataraktiLiteBadge.tone}`}>
                    {kataraktiLiteBadge.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Simplified re-entry rules for comparative execution alongside the core CFD system.
                </p>
                <div className="mt-4 grid gap-2 text-xs text-teal-200/80">
                  <span>3-minute dwell then re-entry</span>
                  <span>Weekly bias filter retained</span>
                </div>
              </Link>
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
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
