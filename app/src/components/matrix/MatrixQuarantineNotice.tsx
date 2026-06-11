/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MatrixQuarantineNotice.tsx
 *
 * Description:
 * Placeholder for the quarantined Matrix active flow.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export default function MatrixQuarantineNotice() {
  return (
    <section className="rounded-2xl border border-(--panel-border) bg-(--panel) p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--foreground)">
        Matrix
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-(--foreground)">
        Matrix is quarantined for v2.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-(--muted)">
        The Matrix surface is preserved in code for audit and future cleanup, but it is not part
        of the active v2 flow. Performance and Basket now use the versioned canon path.
      </p>
    </section>
  );
}
