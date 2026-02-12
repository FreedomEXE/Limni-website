import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import ConnectedAccountRiskSettings from "@/components/ConnectedAccountRiskSettings";
import AccountClientView from "@/components/accounts/AccountClientView";
import { resolveCommonAccountSearchParams } from "@/lib/accounts/navigation";
import {
  buildConnectedOpenPositions,
  extractConnectedMappedRows,
} from "@/lib/accounts/connectedViewHelpers";
import {
  normalizeMappedRows,
} from "@/lib/accounts/connectedPlanning";
import {
  decodeAccountKeyCandidates,
  findConnectedAccountByCandidates,
} from "@/lib/accounts/connectedLookup";
import {
  loadConnectedWeekData,
  resolveConnectedWeekContext,
} from "@/lib/accounts/connectedPageData";
import { buildConnectedAccountClientViewProps } from "@/lib/accounts/connectedPageProps";
import { buildConnectedPlannedView } from "@/lib/accounts/connectedPlannedFlow";
import { unstable_noStore } from "next/cache";

export const dynamic = "force-dynamic";

type ConnectedAccountPageProps = {
  params: { accountKey: string } | Promise<{ accountKey: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConnectedAccountPage({
  params,
  searchParams,
}: ConnectedAccountPageProps) {
  unstable_noStore();
  const resolvedParams = await Promise.resolve(params);
  const rawParam = resolvedParams?.accountKey ?? "";

  // Decode account key
  const candidates = decodeAccountKeyCandidates(rawParam);
  const account = await findConnectedAccountByCandidates(candidates);

  if (!account) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Account Not Found</h1>
          <p className="text-[color:var(--muted)]">
            Could not find account: <code>{rawParam}</code>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const analysis = account.analysis;

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const { week: weekParamValue, view: activeView } =
    resolveCommonAccountSearchParams(resolvedSearchParams);
  const {
    currentWeekOpenUtc,
    weekOptionsWithUpcoming,
    selectedWeek,
  } = await resolveConnectedWeekContext({
    accountKey: account.account_key,
    weekParamValue,
  });

  const { stats, basketSignals, equityCurve, staticDrawdownPct, trailingDrawdownPct } =
    await loadConnectedWeekData({
    accountKey: account.account_key,
    selectedWeek,
    currentWeekOpenUtc,
  });

  const planned = await buildConnectedPlannedView({
    provider: account.provider,
    accountKey: account.account_key,
    config: account.config ?? null,
    selectedWeek,
    basketPairs: basketSignals.pairs,
    statsEquity: stats.equity,
  });
  const plannedPairs = planned.plannedPairs;
  const plannedNote = planned.plannedNote;
  const plannedSummary = planned.plannedSummary;

  // Extract mapped instruments
  const mapped = extractConnectedMappedRows(analysis);
  const mappedRows = normalizeMappedRows({
    provider: account.provider,
    mapped,
  });

  const settingsExtras = (
    <div className="space-y-4">
      <ConnectedAccountRiskSettings accountKey={account.account_key} riskMode={account.risk_mode} />
      {account.provider === "oanda" ? <ConnectedAccountSizing accountKey={account.account_key} /> : null}
    </div>
  );

  const openPositions = buildConnectedOpenPositions({
    provider: account.provider,
    analysis,
  });

  const connectedViewProps = buildConnectedAccountClientViewProps({
    activeView,
    account: {
      account_key: account.account_key,
      label: account.label,
      provider: account.provider,
      risk_mode: account.risk_mode,
      config: account.config ?? null,
      last_sync_utc: account.last_sync_utc,
    },
    weekOptionsWithUpcoming,
    currentWeekOpenUtc,
    selectedWeek,
    stats,
    plannedPairs,
    plannedNote,
    plannedSummary,
    equityCurve,
    staticDrawdownPct,
    trailingDrawdownPct,
    mappedRows,
    openPositions,
  });


  return (
    <DashboardLayout>
      <AccountClientView {...connectedViewProps} settingsExtras={settingsExtras} />
    </DashboardLayout>
  );
}
