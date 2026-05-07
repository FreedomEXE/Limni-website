/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts (cron/canonical-refresh)
 *
 * Description:
 * Refreshes canonical daily price bars and pair period returns for the current
 * and previous trading weeks. Runs automatically so data section always has
 * the latest week available. Hourly bars are optional via ?includeHourly=1 so
 * the weekly return refresh cannot be starved by slower intraday work.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { isCronAuthorized } from "@/lib/cronAuth";
import { revalidatePath } from "next/cache";
import { CANONICAL_INSTRUMENTS } from "@/lib/canonicalInstruments";
import {
  CANONICAL_WEEKS,
  getCanonicalWeekWindow,
} from "@/lib/canonicalPriceWindows";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { fetchOandaCandleSeries, fetchOandaDailySeries } from "@/lib/oandaPrices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

type DailyBar = {
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
};

type CoverageGap = {
  weekOpenUtc: string;
  expectedCount: number;
  actualCount: number;
  missingSymbols: string[];
};

function instrumentCoverageKey(instrument: { symbol: string; assetClass: string }) {
  return `${instrument.assetClass}:${instrument.symbol.toUpperCase()}`;
}

async function checkWeeklyReturnCoverage(
  targetWeeks: string[],
  instruments: Array<{ symbol: string; assetClass: string }>,
): Promise<CoverageGap[]> {
  const expectedKeys = instruments.map(instrumentCoverageKey);
  const rows = await query<{
    symbol: string;
    asset_class: string;
    period_open_utc: Date;
  }>(
    `SELECT symbol, asset_class, period_open_utc
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND period_open_utc = ANY($1::timestamptz[])`,
    [targetWeeks],
  );

  const actualByWeek = new Map<string, Set<string>>();
  for (const weekOpen of targetWeeks) {
    actualByWeek.set(weekOpen, new Set());
  }

  for (const row of rows) {
    const weekOpenUtc = row.period_open_utc.toISOString();
    const actual = actualByWeek.get(weekOpenUtc);
    if (!actual) continue;
    actual.add(`${row.asset_class}:${row.symbol.toUpperCase()}`);
  }

  return targetWeeks
    .map((weekOpenUtc) => {
      const actual = actualByWeek.get(weekOpenUtc) ?? new Set<string>();
      const missingSymbols = instruments
        .filter((instrument, index) => !actual.has(expectedKeys[index]!))
        .map((instrument) => instrument.symbol);
      return {
        weekOpenUtc,
        expectedCount: expectedKeys.length,
        actualCount: expectedKeys.length - missingSymbols.length,
        missingSymbols,
      };
    })
    .filter((gap) => gap.missingSymbols.length > 0);
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const nowUtc = DateTime.utc();
  const url = new URL(request.url);
  const includeHourly = ["1", "true", "yes"].includes(
    (url.searchParams.get("includeHourly") ?? "").toLowerCase(),
  );
  const activeInstruments = CANONICAL_INSTRUMENTS.filter((instrument) => instrument.isActive);

  // Determine which weeks need refreshing: current + previous
  const currentWeekOpen = getCanonicalWeekOpenUtc(nowUtc);
  const prevWeekOpen = getCanonicalWeekOpenUtc(
    nowUtc.minus({ weeks: 1 }),
  );
  const targetWeeks = [prevWeekOpen, currentWeekOpen].filter(
    (w) => CANONICAL_WEEKS.includes(w),
  );

  if (targetWeeks.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No canonical weeks to refresh",
      currentWeekOpen,
    });
  }

  // Find the date range we need daily bars for (covers both weeks)
  const allWindows = targetWeeks.flatMap((weekOpen) =>
    ["fx", "indices", "commodities", "crypto"].map((ac) =>
      getCanonicalWeekWindow(weekOpen, ac as "fx" | "indices" | "commodities" | "crypto"),
    ),
  );
  const fromUtc = DateTime.fromMillis(
    Math.min(...allWindows.map((w) => w.openUtc.toMillis())),
  ).minus({ days: 2 }); // buffer for daily bar alignment
  const toUtc = DateTime.fromMillis(
    Math.max(...allWindows.map((w) => w.closeUtc.toMillis())),
  ).plus({ days: 1 });

  let barsUpserted = 0;
  let hourlyBarsUpserted = 0;
  let weeklyReturnsUpserted = 0;
  const errors: string[] = [];

  for (const instrument of CANONICAL_INSTRUMENTS) {
    if (!instrument.isActive) continue;

    try {
      // Fetch daily bars from provider
      let dailyBars: DailyBar[] = [];

      if (instrument.primaryProvider === "oanda" && instrument.oandaInstrument) {
        const alignment =
          instrument.assetClass === "indices" || instrument.assetClass === "commodities"
            ? 18
            : instrument.assetClass === "crypto"
              ? 20
              : 17;

        const providerBars = await fetchOandaDailySeries(
          instrument.oandaInstrument,
          fromUtc,
          toUtc,
          alignment,
        );

        const closeOffsetHours =
          instrument.assetClass === "indices" || instrument.assetClass === "commodities"
            ? 23
            : 24;

        dailyBars = providerBars.map((bar) => {
          const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
          return {
            barOpenUtc: openDt.toISO()!,
            barCloseUtc: openDt.plus({ hours: closeOffsetHours }).toISO()!,
            openPrice: round(bar.open),
            highPrice: round(bar.high),
            lowPrice: round(bar.low),
            closePrice: round(bar.close),
          };
        });
      } else if (instrument.primaryProvider === "bitget" && instrument.bitgetBaseCoin) {
        // Bitget: fetch hourly, aggregate to daily
        const { fetchBitgetSpotCandleSeries } = await import("@/lib/bitget");
        const hourlyBars = await fetchBitgetSpotCandleSeries(instrument.bitgetBaseCoin, {
          openUtc: fromUtc,
          closeUtc: toUtc,
        });

        // Group hourly bars by UTC day
        const grouped = new Map<string, typeof hourlyBars>();
        for (const bar of hourlyBars) {
          const dayKey = DateTime.fromMillis(bar.ts, { zone: "utc" }).startOf("day").toISO()!;
          const list = grouped.get(dayKey) ?? [];
          list.push(bar);
          grouped.set(dayKey, list);
        }

        for (const [dayKey, bars] of grouped) {
          if (bars.length === 0) continue;
          const first = bars[0]!;
          const last = bars[bars.length - 1]!;
          dailyBars.push({
            barOpenUtc: dayKey,
            barCloseUtc: DateTime.fromISO(dayKey, { zone: "utc" }).plus({ days: 1 }).toISO()!,
            openPrice: round(first.open),
            highPrice: round(Math.max(...bars.map((b) => b.high))),
            lowPrice: round(Math.min(...bars.map((b) => b.low))),
            closePrice: round(last.close),
          });
        }
      }

      if (dailyBars.length === 0) {
        errors.push(`${instrument.symbol}: no daily bars returned`);
        continue;
      }

      // Upsert canonical daily bars
      for (const bar of dailyBars) {
        await query(
          `INSERT INTO canonical_price_bars (symbol, asset_class, timeframe, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price, source_provider, quality_status)
           VALUES ($1, $2, '1d', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, 'provider_daily')
           ON CONFLICT (symbol, timeframe, bar_open_utc)
           DO UPDATE SET
             bar_close_utc = EXCLUDED.bar_close_utc,
             open_price = EXCLUDED.open_price,
             high_price = EXCLUDED.high_price,
             low_price = EXCLUDED.low_price,
             close_price = EXCLUDED.close_price,
             source_provider = EXCLUDED.source_provider,
             quality_status = EXCLUDED.quality_status,
             updated_at = NOW()`,
          [
            instrument.symbol, instrument.assetClass,
            bar.barOpenUtc, bar.barCloseUtc,
            bar.openPrice, bar.highPrice, bar.lowPrice, bar.closePrice,
            instrument.primaryProvider,
          ],
        );
        barsUpserted++;
      }

      if (includeHourly && instrument.primaryProvider === "oanda" && instrument.oandaInstrument) {
        const hourlyBars = await fetchOandaCandleSeries(
          instrument.oandaInstrument,
          fromUtc,
          toUtc,
        );

        for (const bar of hourlyBars) {
          const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
          await query(
            `INSERT INTO canonical_price_bars (symbol, asset_class, timeframe, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price, source_provider, quality_status)
             VALUES ($1, $2, '1h', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, 'provider_hourly')
             ON CONFLICT (symbol, timeframe, bar_open_utc)
             DO UPDATE SET
               bar_close_utc = EXCLUDED.bar_close_utc,
               open_price = EXCLUDED.open_price,
               high_price = EXCLUDED.high_price,
               low_price = EXCLUDED.low_price,
               close_price = EXCLUDED.close_price,
               source_provider = EXCLUDED.source_provider,
               quality_status = EXCLUDED.quality_status,
               updated_at = NOW()`,
            [
              instrument.symbol,
              instrument.assetClass,
              openDt.toISO(),
              openDt.plus({ hours: 1 }).toISO(),
              round(bar.open),
              round(bar.high),
              round(bar.low),
              round(bar.close),
              "oanda",
            ],
          );
          hourlyBarsUpserted++;
        }
      } else if (includeHourly && instrument.primaryProvider === "bitget" && instrument.bitgetBaseCoin) {
        const { fetchBitgetSpotCandleSeries } = await import("@/lib/bitget");
        const hourlyBars = await fetchBitgetSpotCandleSeries(instrument.bitgetBaseCoin, {
          openUtc: fromUtc,
          closeUtc: toUtc,
        });

        for (const bar of hourlyBars) {
          const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
          await query(
            `INSERT INTO canonical_price_bars (symbol, asset_class, timeframe, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price, source_provider, quality_status)
             VALUES ($1, $2, '1h', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, 'provider_hourly_spot')
             ON CONFLICT (symbol, timeframe, bar_open_utc)
             DO UPDATE SET
               bar_close_utc = EXCLUDED.bar_close_utc,
               open_price = EXCLUDED.open_price,
               high_price = EXCLUDED.high_price,
               low_price = EXCLUDED.low_price,
               close_price = EXCLUDED.close_price,
               source_provider = EXCLUDED.source_provider,
               quality_status = EXCLUDED.quality_status,
               updated_at = NOW()`,
            [
              instrument.symbol,
              instrument.assetClass,
              openDt.toISO(),
              openDt.plus({ hours: 1 }).toISO(),
              round(bar.open),
              round(bar.high),
              round(bar.low),
              round(bar.close),
              instrument.assetClass === "crypto" ? "bitget_spot" : "bitget",
            ],
          );
          hourlyBarsUpserted++;
        }
      }

      // Derive weekly returns for target weeks
      for (const weekOpen of targetWeeks) {
        const window = getCanonicalWeekWindow(weekOpen, instrument.assetClass);
        const weekBars = dailyBars.filter((bar) => {
          const barMs = DateTime.fromISO(bar.barOpenUtc, { zone: "utc" }).toMillis();
          return barMs >= window.openUtc.toMillis() && barMs < window.closeUtc.toMillis();
        });

        if (weekBars.length === 0) continue;

        const first = weekBars[0]!;
        const last = weekBars[weekBars.length - 1]!;
        const returnPct = first.openPrice === 0
          ? 0
          : round(((last.closePrice - first.openPrice) / first.openPrice) * 100);

        await query(
          `INSERT INTO pair_period_returns (symbol, asset_class, period_type, period_open_utc, period_close_utc, open_price, close_price, high_price, low_price, return_pct, source, derived_from_timeframe, derivation_version)
           VALUES ($1, $2, 'weekly', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, 'canonical_price_bars', '1d', 'v1')
           ON CONFLICT (symbol, asset_class, period_type, period_open_utc)
           DO UPDATE SET
             period_close_utc = EXCLUDED.period_close_utc,
             open_price = EXCLUDED.open_price,
             close_price = EXCLUDED.close_price,
             high_price = EXCLUDED.high_price,
             low_price = EXCLUDED.low_price,
             return_pct = EXCLUDED.return_pct,
             source = EXCLUDED.source,
             derived_from_timeframe = EXCLUDED.derived_from_timeframe,
             derivation_version = EXCLUDED.derivation_version,
             updated_at = NOW()`,
          [
            instrument.symbol, instrument.assetClass,
            weekOpen, window.closeUtc.toISO(),
            first.openPrice, last.closePrice,
            round(Math.max(...weekBars.map((b) => b.highPrice))),
            round(Math.min(...weekBars.map((b) => b.lowPrice))),
            returnPct,
          ],
        );
        weeklyReturnsUpserted++;
      }
    } catch (err) {
      errors.push(`${instrument.symbol}: ${(err as Error).message}`);
    }

    // Rate limit between instruments
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Revalidate data section pages
  for (const path of ["/dashboard", "/performance", "/sentiment", "/flagship"]) {
    revalidatePath(path);
  }
  const coverageGaps = await checkWeeklyReturnCoverage(targetWeeks, activeInstruments);
  const ok = errors.length === 0 && coverageGaps.length === 0;

  return NextResponse.json(
    {
      ok,
      durationMs: Date.now() - startedAt,
      targetWeeks,
      barsUpserted,
      hourlyBarsUpserted,
      weeklyReturnsUpserted,
      instruments: activeInstruments.length,
      includeHourly,
      coverageGaps: coverageGaps.length > 0 ? coverageGaps : undefined,
      errors: errors.length > 0 ? errors : undefined,
    },
    { status: ok ? 200 : 500 },
  );
}
