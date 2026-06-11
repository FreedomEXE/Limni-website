/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketEmptyState.tsx
 *
 * Description:
 * Empty state for the all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

type BasketEmptyStateProps = {
  message?: string;
};

export default function BasketEmptyState({ message = "No basket trades matched this selection." }: BasketEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-(--panel-border) px-4 py-6 text-sm text-(--muted)">
      {message}
    </div>
  );
}
