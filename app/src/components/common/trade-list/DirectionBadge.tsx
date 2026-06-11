/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: DirectionBadge.tsx
 *
 * Description:
 * Quiet direction marker for trade and fill rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

type DirectionBadgeProps = {
  direction?: "LONG" | "SHORT" | null;
};

export default function DirectionBadge({ direction }: DirectionBadgeProps) {
  if (direction === "LONG") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
        <span aria-hidden="true">↑</span>
        LONG
      </span>
    );
  }

  if (direction === "SHORT") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300">
        <span aria-hidden="true">↓</span>
        SHORT
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--muted)">
      <span aria-hidden="true">·</span>
      Neutral
    </span>
  );
}
