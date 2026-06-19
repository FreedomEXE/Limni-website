import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import { getCanonicalWeekWindow } from "../../src/lib/canonicalPriceWindows";
import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import { getPool } from "../../src/lib/db";
import {
  buildFxWeeklyStrengthContextFromIndex,
  buildFxStrengthHistoryIndex,
  DEFAULT_FX_STRENGTH_HISTORY_WINDOWS,
  deriveFxStrengthHistoryAtTimesFromM1,
  deriveFxStrengthHistoryFromM1,
  estimateFxStrengthHistoryStorage,
  getFxWeeklyStrengthDecisionPoints,
  lookupFxPairStrengthAt,
  readFxStrengthHistoryIndex,
  writeFxStrengthHistorySnapshots,
  type HistoricalStrengthWindow,
  type FxWeeklyStrengthDecisionPointId,
} from "../../src/lib/strength/historicalStrength";
import { readWeeklyPairStrengthsAtCutoff } from "../../src/lib/strength/weeklyStrength";
import { normalizeWeekOpenUtc } from "../../src/lib/weekAnchor";

type CliOptions = {
  fromUtc?: string;
  toUtc?: string;
  weekOpenUtc?: string;
  cadenceMinutes: number;
  windows: HistoricalStrengthWindow[];
  minPairCoveragePct: number;
  write: boolean;
  readBack: boolean;
  readExistingOnly: boolean;
  compareLegacy: boolean;
  lookupTimes: string[];
  pairs: string[];
  estimateOnly: boolean;
  weeklyContext: boolean;
  contextWeeks: string[];
  marketOpenForwardMinutes: number;
  deriveWeeklyContextSnapshots: boolean;
  contextSnapshotBackwardMinutes: number;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNumber(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIso(value: string, label: string) {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed.toUTC().toISO() ?? value;
}

function parseWindow(value: string): HistoricalStrengthWindow {
  if (
    value === "15m" ||
    value === "30m" ||
    value === "1h" ||
    value === "4h" ||
    value === "24h" ||
    value === "1w" ||
    value === "1m"
  ) {
    return value;
  }
  throw new Error(`Unsupported strength window: ${value}`);
}

function parseWindows(value: string | null): HistoricalStrengthWindow[] {
  if (!value) return DEFAULT_FX_STRENGTH_HISTORY_WINDOWS;
  return value
    .split(",")
    .map((window) => parseWindow(window.trim()))
    .filter(Boolean);
}

function parseCsv(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCli(): CliOptions {
  return {
    fromUtc: argValue("from") ? normalizeIso(argValue("from")!, "from") : undefined,
    toUtc: argValue("to") ? normalizeIso(argValue("to")!, "to") : undefined,
    weekOpenUtc: argValue("week") ? normalizeWeekOpenUtc(argValue("week")!) ?? normalizeIso(argValue("week")!, "week") : undefined,
    cadenceMinutes: parsePositiveInteger(argValue("cadence-minutes") ?? argValue("cadence"), 15),
    windows: parseWindows(argValue("windows")),
    minPairCoveragePct: parseNumber(argValue("min-pair-coverage-pct"), 90),
    write: hasFlag("write"),
    readBack: hasFlag("read-back"),
    readExistingOnly: hasFlag("read-existing-only"),
    compareLegacy: hasFlag("compare-legacy"),
    lookupTimes: parseCsv(argValue("lookup-times")),
    pairs: parseCsv(argValue("pairs")).map((pair) => pair.toUpperCase()),
    estimateOnly: hasFlag("estimate-only"),
    weeklyContext: hasFlag("weekly-context"),
    contextWeeks: parseCsv(argValue("context-weeks")),
    marketOpenForwardMinutes: parsePositiveInteger(
      argValue("market-open-forward-minutes") ?? argValue("monday-open-forward-minutes"),
      180,
    ),
    deriveWeeklyContextSnapshots: hasFlag("derive-weekly-context-snapshots"),
    contextSnapshotBackwardMinutes: parsePositiveInteger(argValue("context-snapshot-backward-minutes"), 60),
  };
}

function resolveRange(options: CliOptions) {
  if (options.weekOpenUtc) {
    const window = getCanonicalWeekWindow(options.weekOpenUtc, "fx");
    return {
      fromUtc: window.openUtc.toISO() ?? options.weekOpenUtc,
      toUtc: window.closeUtc.toISO() ?? options.weekOpenUtc,
      weekOpenUtc: options.weekOpenUtc,
    };
  }
  if (!options.fromUtc || !options.toUtc) {
    throw new Error("Provide --week=YYYY-MM-DD or both --from and --to.");
  }
  return {
    fromUtc: options.fromUtc,
    toUtc: options.toUtc,
    weekOpenUtc: undefined,
  };
}

function defaultLookupTimes(options: CliOptions, range: ReturnType<typeof resolveRange>) {
  if (options.lookupTimes.length > 0) {
    return options.lookupTimes.map((value) => normalizeIso(value, "lookup-times"));
  }
  if (range.weekOpenUtc) {
    return [range.fromUtc, range.toUtc];
  }
  return [range.toUtc];
}

function printStorageEstimates(windows: HistoricalStrengthWindow[]) {
  for (const cadenceMinutes of [1, 5, 15]) {
    const estimate = estimateFxStrengthHistoryStorage({
      cadenceMinutes,
      windows,
      years: 7,
    });
    console.log(
      [
        `estimate cadence=${cadenceMinutes}m`,
        `snapshots=${estimate.snapshotCount}`,
        `currencyRows=${estimate.currencySnapshotRows}`,
        `pairLookupCells=${estimate.pairSpreadCells}`,
      ].join(" | "),
    );
  }
}

async function compareLegacyCutoff(options: {
  lookupTimeUtc: string;
  pairs: string[];
  windows: HistoricalStrengthWindow[];
  index: ReturnType<typeof buildFxStrengthHistoryIndex>;
}) {
  const legacy = await readWeeklyPairStrengthsAtCutoff(options.lookupTimeUtc);
  const legacyByPair = new Map(legacy.map((row) => [row.pair.toUpperCase(), row]));
  let compared = 0;
  let directionMatches = 0;
  let missing = 0;
  let spreadDeltaSum = 0;

  for (const pair of options.pairs) {
    const legacyPair = legacyByPair.get(pair.toUpperCase());
    if (!legacyPair) {
      missing += options.windows.length;
      continue;
    }
    for (const window of options.windows) {
      if (window !== "1h" && window !== "4h" && window !== "24h") continue;
      const legacyWindow = legacyPair.windows.find((row) => row.window === window);
      const reconstructed = lookupFxPairStrengthAt(options.index, pair, options.lookupTimeUtc, window);
      if (!legacyWindow?.available || !reconstructed.available) {
        missing++;
        continue;
      }
      compared++;
      if (legacyWindow.direction === reconstructed.direction) {
        directionMatches++;
      }
      spreadDeltaSum += Math.abs((legacyWindow.signedSpread ?? 0) - (reconstructed.signedSpread ?? 0));
    }
  }

  console.log(
    [
      `legacyCompare cutoff=${options.lookupTimeUtc}`,
      `compared=${compared}`,
      `directionMatches=${directionMatches}`,
      `missing=${missing}`,
      `avgAbsSpreadDelta=${compared > 0 ? (spreadDeltaSum / compared).toFixed(4) : "-"}`,
    ].join(" | "),
  );
}

function weeklyContextWeeks(options: CliOptions, range: ReturnType<typeof resolveRange>) {
  const weeks = options.contextWeeks.length > 0
    ? options.contextWeeks
    : range.weekOpenUtc
      ? [range.weekOpenUtc]
      : [];
  return weeks.map((week) => normalizeWeekOpenUtc(week) ?? normalizeIso(week, "context-weeks"));
}

function weeklyContextWeeksFromRange(range: ReturnType<typeof resolveRange>) {
  const from = DateTime.fromISO(range.fromUtc, { zone: "utc" });
  const to = DateTime.fromISO(range.toUtc, { zone: "utc" });
  if (!from.isValid || !to.isValid) return [];
  let cursor = from.startOf("day");
  while (cursor.weekday !== 1) {
    cursor = cursor.plus({ days: 1 });
  }
  const weeks: string[] = [];
  while (cursor.toMillis() < to.toMillis()) {
    const week = normalizeWeekOpenUtc(cursor.toISODate() ?? cursor.toISO() ?? "");
    if (week) weeks.push(week);
    cursor = cursor.plus({ weeks: 1 });
  }
  return [...new Set(weeks)].sort();
}

function weeklyContextSnapshotTimes(options: {
  weeks: string[];
  cadenceMinutes: number;
  marketOpenForwardMinutes: number;
  contextSnapshotBackwardMinutes: number;
}) {
  const cadence = Math.max(1, Math.floor(options.cadenceMinutes));
  const backward = Math.max(0, Math.floor(options.contextSnapshotBackwardMinutes));
  const times = new Set<string>();

  for (const weekOpenUtc of options.weeks) {
    for (const point of getFxWeeklyStrengthDecisionPoints(weekOpenUtc, {
      marketOpenForwardMinutes: options.marketOpenForwardMinutes,
    })) {
      const requested = DateTime.fromISO(point.requestedTimeUtc, { zone: "utc" });
      if (!requested.isValid) continue;
      if (point.lookupMode === "at_or_after") {
        const maxForward = Math.max(0, Math.floor(point.maxForwardMinutes ?? options.marketOpenForwardMinutes));
        for (let offset = 0; offset <= maxForward; offset += cadence) {
          times.add(requested.plus({ minutes: offset }).toUTC().toISO() ?? point.requestedTimeUtc);
        }
      } else {
        for (let offset = backward; offset >= 0; offset -= cadence) {
          times.add(requested.minus({ minutes: offset }).toUTC().toISO() ?? point.requestedTimeUtc);
        }
      }
    }
  }

  return [...times].sort();
}

function printWeeklyContext(options: {
  weekOpenUtc: string;
  index: ReturnType<typeof buildFxStrengthHistoryIndex>;
  pairs: string[];
  windows: HistoricalStrengthWindow[];
  marketOpenForwardMinutes: number;
}) {
  const context = buildFxWeeklyStrengthContextFromIndex({
    weekOpenUtc: options.weekOpenUtc,
    index: options.index,
    pairs: options.pairs,
    windows: options.windows,
    marketOpenForwardMinutes: options.marketOpenForwardMinutes,
  });
  const pointIds: FxWeeklyStrengthDecisionPointId[] = ["friday_close", "market_open_confirmation"];
  console.log(`weeklyContext week=${context.weekOpenUtc} points=${pointIds.join(",")}`);

  for (const pointId of pointIds) {
    const rows = context.rows.filter((row) => row.pointId === pointId);
    const available = rows.filter((row) => row.available).length;
    const long = rows.filter((row) => row.direction === "LONG").length;
    const short = rows.filter((row) => row.direction === "SHORT").length;
    const neutral = rows.filter((row) => row.direction === "NEUTRAL").length;
    const missingReasons = rows.reduce<Record<string, number>>((acc, row) => {
      if (!row.missingReason) return acc;
      acc[row.missingReason] = (acc[row.missingReason] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      [
        `weeklyContextSummary point=${pointId}`,
        `available=${available}/${rows.length}`,
        `long=${long}`,
        `short=${short}`,
        `neutral=${neutral}`,
        `missing=${JSON.stringify(missingReasons)}`,
      ].join(" | "),
    );
  }

  const rowsByPair = new Map<string, typeof context.rows>();
  for (const row of context.rows) {
    const rows = rowsByPair.get(row.pair) ?? [];
    rows.push(row);
    rowsByPair.set(row.pair, rows);
  }
  for (const pair of options.pairs.slice(0, Math.min(5, options.pairs.length))) {
    const rows = rowsByPair.get(pair) ?? [];
    console.log(
      [
        `weeklyContextPair pair=${pair}`,
        ...pointIds.map((pointId) => {
          const row = rows.find((candidate) => candidate.pointId === pointId);
          if (!row) return `${pointId}:missing`;
          const resolved = row.resolvedTimeUtc ? row.resolvedTimeUtc.replace(".000Z", "Z") : "none";
          return `${pointId}:${row.available ? row.direction : "missing"}:score=${row.compositeScore ?? "-"}:windows=${row.availableWindows}/${options.windows.length}:resolved=${resolved}`;
        }),
      ].join(" | "),
    );
  }
}

async function main() {
  const options = parseCli();
  const range = resolveRange(options);
  const pairs = options.pairs.length > 0
    ? options.pairs
    : PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
  const lookupTimes = defaultLookupTimes(options, range);
  const contextWeeks = weeklyContextWeeks(options, range);

  console.log(
    [
      "Gate 43 Strength history context",
      `from=${range.fromUtc}`,
      `to=${range.toUtc}`,
      `cadence=${options.cadenceMinutes}m`,
      `windows=${options.windows.join(",")}`,
      `write=${options.write}`,
      `readBack=${options.readBack}`,
      `readExistingOnly=${options.readExistingOnly}`,
      `weeklyContext=${options.weeklyContext}`,
      `deriveWeeklyContextSnapshots=${options.deriveWeeklyContextSnapshots}`,
    ].join(" | "),
  );
  printStorageEstimates(options.windows);

  if (options.estimateOnly) {
    return;
  }

  const index = options.readExistingOnly
    ? await (async () => {
        const readStartedAt = Date.now();
        const existing = await readFxStrengthHistoryIndex({
          fromUtc: range.fromUtc,
          toUtc: range.toUtc,
          windows: options.windows,
        });
        const rowCount = [...existing.rowsByCurrencyWindow.values()]
          .reduce((sum, rows) => sum + rows.length, 0);
        console.log(`readExisting rows=${rowCount} elapsed=${((Date.now() - readStartedAt) / 1000).toFixed(2)}s`);
        return existing;
      })()
    : options.deriveWeeklyContextSnapshots
      ? await (async () => {
          const weeks = contextWeeks.length > 0 ? contextWeeks : weeklyContextWeeksFromRange(range);
          const startedAt = Date.now();
          const snapshots: Awaited<ReturnType<typeof deriveFxStrengthHistoryAtTimesFromM1>>["snapshots"] = [];
          let snapshotTimesCount = 0;
          let completeRows = 0;
          let incompleteRows = 0;
          let minCoveragePct = Number.POSITIVE_INFINITY;
          let maxCoveragePct = Number.NEGATIVE_INFINITY;

          for (const week of weeks) {
            const snapshotTimes = weeklyContextSnapshotTimes({
              weeks: [week],
              cadenceMinutes: options.cadenceMinutes,
              marketOpenForwardMinutes: options.marketOpenForwardMinutes,
              contextSnapshotBackwardMinutes: options.contextSnapshotBackwardMinutes,
            });
            const derived = await deriveFxStrengthHistoryAtTimesFromM1({
              snapshotTimesUtc: snapshotTimes,
              windows: options.windows,
              minPairCoveragePct: options.minPairCoveragePct,
            });
            snapshots.push(...derived.snapshots);
            snapshotTimesCount += derived.summary.snapshotsGenerated;
            completeRows += derived.summary.completeRows;
            incompleteRows += derived.summary.incompleteRows;
            minCoveragePct = Math.min(minCoveragePct, derived.summary.minCoveragePct);
            maxCoveragePct = Math.max(maxCoveragePct, derived.summary.maxCoveragePct);

            if (options.write) {
              const writeStartedAt = Date.now();
              const rowsWritten = await writeFxStrengthHistorySnapshots(derived.snapshots);
              console.log(
                [
                  `writtenWeeklyContextSnapshots week=${week.replace(".000Z", "Z")}`,
                  `snapshotTimes=${derived.summary.snapshotsGenerated}`,
                  `rows=${rowsWritten}`,
                  `completeRows=${derived.summary.completeRows}`,
                  `elapsed=${((Date.now() - writeStartedAt) / 1000).toFixed(2)}s`,
                ].join(" | "),
              );
            }
          }

          const rowsGenerated = snapshots.length;
          console.log(
            [
              "derivedWeeklyContextSnapshots",
              `weeks=${weeks.length}`,
              `snapshotTimes=${snapshotTimesCount}`,
              `rows=${rowsGenerated}`,
              `completeRows=${completeRows}`,
              `incompleteRows=${incompleteRows}`,
              `coverage=${Number.isFinite(minCoveragePct) ? minCoveragePct.toFixed(2) : "0.00"}-${Number.isFinite(maxCoveragePct) ? maxCoveragePct.toFixed(2) : "0.00"}%`,
              `elapsed=${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
            ].join(" | "),
          );

          return options.write && options.readBack
            ? await readFxStrengthHistoryIndex({
                fromUtc: range.fromUtc,
                toUtc: range.toUtc,
                windows: options.windows,
              })
            : buildFxStrengthHistoryIndex(snapshots);
        })()
    : await (async () => {
        const startedAt = Date.now();
        const derived = await deriveFxStrengthHistoryFromM1({
          fromUtc: range.fromUtc,
          toUtc: range.toUtc,
          cadenceMinutes: options.cadenceMinutes,
          windows: options.windows,
          minPairCoveragePct: options.minPairCoveragePct,
        });
        console.log(
          [
            "derived",
            `snapshots=${derived.summary.snapshotsGenerated}`,
            `rows=${derived.summary.rowsGenerated}`,
            `completeRows=${derived.summary.completeRows}`,
            `incompleteRows=${derived.summary.incompleteRows}`,
            `coverage=${derived.summary.minCoveragePct.toFixed(2)}-${derived.summary.maxCoveragePct.toFixed(2)}%`,
            `elapsed=${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
          ].join(" | "),
        );

        if (options.write) {
          const writeStartedAt = Date.now();
          const rowsWritten = await writeFxStrengthHistorySnapshots(derived.snapshots);
          console.log(`written rows=${rowsWritten} elapsed=${((Date.now() - writeStartedAt) / 1000).toFixed(2)}s`);
        }

        return options.write && options.readBack
          ? await readFxStrengthHistoryIndex({
        fromUtc: range.fromUtc,
        toUtc: range.toUtc,
        windows: options.windows,
      })
          : buildFxStrengthHistoryIndex(derived.snapshots);
      })();

  for (const lookupTimeUtc of lookupTimes) {
    for (const pair of pairs.slice(0, Math.min(5, pairs.length))) {
      const lookups = options.windows.map((window) =>
        lookupFxPairStrengthAt(index, pair, lookupTimeUtc, window),
      );
      console.log(
        [
          `lookup time=${lookupTimeUtc}`,
          `pair=${pair}`,
          ...lookups.map((row) =>
            `${row.window}:${row.available ? `${row.direction}:${row.signedSpread?.toFixed(2)}:${Math.min(row.coverageBasePct ?? 0, row.coverageQuotePct ?? 0).toFixed(1)}%` : "missing"}`,
          ),
        ].join(" | "),
      );
    }

    if (options.compareLegacy) {
      await compareLegacyCutoff({
        lookupTimeUtc,
        pairs,
        windows: options.windows,
        index,
      });
    }
  }

  if (options.weeklyContext) {
    if (contextWeeks.length === 0) {
      throw new Error("Provide --week or --context-weeks when using --weekly-context with --from/--to.");
    }
    for (const weekOpenUtc of contextWeeks) {
      printWeeklyContext({
        weekOpenUtc,
        index,
        pairs,
        windows: options.windows,
        marketOpenForwardMinutes: options.marketOpenForwardMinutes,
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created.
    }
  });
