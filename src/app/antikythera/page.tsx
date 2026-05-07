/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: antikythera/page.tsx
 *
 * Description:
 * Redirect shim. The old Antikythera data page has been replaced by the
 * canonical Data dashboard at /dashboard.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AntikytheraRedirectProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AntikytheraRedirect({ searchParams }: AntikytheraRedirectProps) {
  const resolved = (await Promise.resolve(searchParams)) ?? {};
  const params = new URLSearchParams();
  params.set("bias", "dealer");

  const report = Array.isArray(resolved.report) ? resolved.report[0] : resolved.report;
  if (report) params.set("report", report);

  const asset = Array.isArray(resolved.asset) ? resolved.asset[0] : resolved.asset;
  if (asset) params.set("asset", asset);

  const view = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view;
  if (view) params.set("view", view);

  redirect(`/dashboard?${params.toString()}`);
}
