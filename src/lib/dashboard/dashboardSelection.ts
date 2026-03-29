/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: dashboardSelection.ts
 *
 * Description:
 * Shared client-side selection helpers for the Data dashboard.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type DashboardBias = "dealer" | "commercial" | "sentiment";

export const DATA_DASHBOARD_BIAS_COMMIT_EVENT = "limni:data-dashboard-bias-commit";

export function resolveDashboardBias(value?: string | null): DashboardBias {
  if (value === "dealer" || value === "commercial" || value === "sentiment") {
    return value;
  }
  return "dealer";
}
