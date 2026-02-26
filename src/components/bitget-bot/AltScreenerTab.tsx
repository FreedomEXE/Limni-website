/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AltScreenerTab.tsx
 *
 * Description:
 * Phase-2 placeholder panel for the Bitget alt universe screener view.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export default function AltScreenerTab() {
  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Alt Screener
      </h3>
      <p className="mt-3 text-sm text-[var(--foreground)]">
        Alt expansion is Phase 2. Core system validation is in progress.
      </p>
      <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm text-[color:var(--muted)]">
        <ul className="list-disc space-y-1 pl-5">
          <li>BTC correlation rankings</li>
          <li>Volume and volatility screening</li>
          <li>Composite fit scores</li>
          <li>Tiered symbol rankings</li>
        </ul>
      </div>
    </section>
  );
}
