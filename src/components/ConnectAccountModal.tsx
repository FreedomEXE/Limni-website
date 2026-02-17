"use client";

import { useEffect, useMemo, useState } from "react";
import InfoModal from "@/components/InfoModal";
import LimniLoading from "@/components/LimniLoading";

type Provider = "oanda" | "bitget" | "mt5";

type ConnectResult = {
  accountKey: string;
  analysis: Record<string, unknown>;
};

type StepState = "idle" | "running" | "done";
type Mt5DownloadFile = {
  key: "ea" | "sizer";
  displayName: string;
  roleLabel: string;
  compiledName: string;
  compiledHref: string;
  sourceName: string;
  sourceHref: string;
};

const MT5_DOWNLOAD_FILES: Mt5DownloadFile[] = [
  {
    key: "ea",
    displayName: "Limni Basket EA",
    roleLabel: "Expert Advisor",
    compiledName: "LimniBasketEA.ex5",
    compiledHref: "/downloads/LimniBasketEA.ex5",
    sourceName: "LimniBasketEA.mq5",
    sourceHref: "/api/mt5/source?file=ea",
  },
  {
    key: "sizer",
    displayName: "Sizing Script Analyzer",
    roleLabel: "Script",
    compiledName: "LimniSizingAudit.ex5",
    compiledHref: "/downloads/LimniSizingAudit.ex5",
    sourceName: "LimniSizingAudit.mq5",
    sourceHref: "/api/mt5/source?file=sizer",
  },
];

function StepRow({ label, state }: { label: string; state: StepState }) {
  return (
    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
      <span>{label}</span>
      <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-2 py-0.5 text-[10px]">
        {state === "running" ? "Running" : state === "done" ? "Done" : "Queued"}
      </span>
    </div>
  );
}

export default function ConnectAccountModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<Provider>("oanda");
  const [label, setLabel] = useState("");
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiPassphrase, setApiPassphrase] = useState("");
  const [env, setEnv] = useState<"live" | "practice" | "demo">("live");
  const [productType, setProductType] = useState("USDT-FUTURES");
  const [leverage, setLeverage] = useState(10);
  const [trailMode, setTrailMode] = useState<"trail" | "hold">("trail");
  const [trailStartPct, setTrailStartPct] = useState(20);
  const [trailOffsetPct, setTrailOffsetPct] = useState(10);
  const [riskMode, setRiskMode] = useState("1:1");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [stepState, setStepState] = useState({
    validate: "idle" as StepState,
    analyze: "idle" as StepState,
    save: "idle" as StepState,
  });
  const [canAccessSource, setCanAccessSource] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadRole() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          authenticated?: boolean;
          canAccessSource?: boolean;
        };
        if (!mounted) return;
        setCanAccessSource(Boolean(data.canAccessSource));
      } catch {
        // Keep null role when unavailable.
      }
    }
    loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  const botLabel = useMemo(() => {
    if (provider === "bitget") return "Crypto Perp Bot (Bitget)";
    if (provider === "mt5") return "MT5 Forex Basket EA";
    return "OANDA Universal Bot";
  }, [provider]);

  async function handleConnect() {
    setError(null);
    setResult(null);
    setConnecting(true);
    setStepState({ validate: "running", analyze: "idle", save: "idle" });

    try {
      const payload = {
        provider,
        label: label || botLabel,
        accountId,
        apiKey,
        apiSecret,
        apiPassphrase,
        env,
        productType,
        leverage,
        botType: provider === "bitget" ? "bitget_perp" : "oanda_universal",
        riskMode,
        trailMode,
        trailStartPct,
        trailOffsetPct,
      };

      const response = await fetch("/api/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setStepState({ validate: "done", analyze: "running", save: "idle" });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Connection failed");
      }
      const data = (await response.json()) as { ok?: boolean; accountKey?: string; analysis?: Record<string, unknown> };
      setStepState({ validate: "done", analyze: "done", save: "done" });
      if (data.accountKey && data.analysis) {
        setResult({ accountKey: data.accountKey, analysis: data.analysis });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStepState({ validate: "done", analyze: "idle", save: "idle" });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <InfoModal
      title={provider === "mt5" ? "Connect MT5 Account" : "Connect Account"}
      subtitle={provider === "mt5" ? "Manual setup" : botLabel}
      onClose={onClose}
    >
      <div className="space-y-4 text-sm text-[color:var(--muted)]">
        <div className="grid grid-cols-3 gap-2">
          {(["oanda", "bitget", "mt5"] as Provider[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setProvider(item);
                setError(null);
                setResult(null);
                setStepState({ validate: "idle", analyze: "idle", save: "idle" });
              }}
              className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                provider === item
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] text-[color:var(--muted)]"
              }`}
            >
              {item === "mt5" ? "MT5 Manual" : item.toUpperCase()}
            </button>
          ))}
        </div>

        {provider === "mt5" ? (
          <>
            <p>
              MT5 accounts are connected by running the EA on your broker terminal.
              Download the compiled files below, then configure push URL, token, and
              license key in MT5. Source files are owner-only.
            </p>
            <div className="space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Available Files
              </p>
              {MT5_DOWNLOAD_FILES.map((file) => (
                <div
                  key={file.key}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--foreground)]">
                      {file.displayName}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {file.roleLabel}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={file.compiledHref}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                      download
                    >
                      {file.compiledName} (.EX5)
                    </a>
                    {canAccessSource ? (
                      <a
                        href={file.sourceHref}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
                      >
                        {file.sourceName} (.MQ5)
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)]/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]/80">
                        {file.sourceName} (.MQ5) Restricted
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {!canAccessSource ? (
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  MQ5 source download is restricted to the owner account.
                </p>
              ) : null}
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-xs uppercase tracking-[0.2em]">
              <li>Open MT5 and add the EA under Experts.</li>
              <li>Enable WebRequest for the Limni push URL.</li>
              <li>Set the push token and license key in EA inputs.</li>
              <li>Attach EA to one chart and keep terminal running.</li>
            </ol>
          </>
        ) : (
          <>
            {connecting ? (
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <LimniLoading label="Configuring account" compact />
                <div className="mt-4 space-y-2">
                  <StepRow label="Validate credentials" state={stepState.validate} />
                  <StepRow label="Analyze instruments" state={stepState.analyze} />
                  <StepRow label="Save configuration" state={stepState.save} />
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-xs uppercase tracking-[0.2em] text-rose-700">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs uppercase tracking-[0.2em] text-emerald-700">
                Connected! Account key: {result.accountKey}
              </div>
            ) : null}

            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                  placeholder={botLabel}
                />
              </label>

              {provider === "oanda" ? (
                <>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    OANDA Account ID
                    <input
                      value={accountId}
                      onChange={(event) => setAccountId(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                      placeholder="001-XXX-XXXXXXX-XXX"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    OANDA API Key
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Environment
                    <select
                      value={env}
                      onChange={(event) => setEnv(event.target.value as "live" | "practice")}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    >
                      <option value="live">Live</option>
                      <option value="practice">Practice</option>
                    </select>
                  </label>
                </>
              ) : null}

              {provider === "bitget" ? (
                <>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    API Key
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    API Secret
                    <input
                      type="password"
                      value={apiSecret}
                      onChange={(event) => setApiSecret(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    API Passphrase
                    <input
                      type="password"
                      value={apiPassphrase}
                      onChange={(event) => setApiPassphrase(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Environment
                    <select
                      value={env}
                      onChange={(event) => setEnv(event.target.value as "live" | "demo")}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    >
                      <option value="live">Live</option>
                      <option value="demo">Demo</option>
                    </select>
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Product Type
                    <input
                      value={productType}
                      onChange={(event) => setProductType(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Leverage
                    <input
                      type="number"
                      value={leverage}
                      onChange={(event) => setLeverage(Number(event.target.value))}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                </>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Risk Mode
                  <select
                    value={riskMode}
                    onChange={(event) => setRiskMode(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                  >
                    <option value="1:1">1:1 (Default)</option>
                    <option value="reduced">Reduced</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Exit Style
                  <select
                    value={trailMode}
                    onChange={(event) => setTrailMode(event.target.value as "trail" | "hold")}
                    className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                  >
                    <option value="trail">Trail (Default)</option>
                    <option value="hold">Hold To Week Close</option>
                  </select>
                </label>
              </div>

              {trailMode === "trail" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Trail Start %
                    <input
                      type="number"
                      value={trailStartPct}
                      onChange={(event) => setTrailStartPct(Number(event.target.value))}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Trail Offset %
                    <input
                      type="number"
                      value={trailOffsetPct}
                      onChange={(event) => setTrailOffsetPct(Number(event.target.value))}
                      className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm text-[var(--foreground)]"
                    />
                  </label>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20 disabled:opacity-60"
            >
              {connecting ? "Connecting..." : "Connect Account"}
            </button>
          </>
        )}
      </div>
    </InfoModal>
  );
}
