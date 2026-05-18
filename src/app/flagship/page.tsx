/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: flagship/page.tsx
 *
 * Description:
 * Legacy matrix route redirecting to the consolidated /matrix
 * workspace.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

type LegacyFlagshipPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyFlagshipPage({ searchParams }: LegacyFlagshipPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const tabParam = resolvedSearchParams.tab;
  if (typeof tabParam === "string" && tabParam.toLowerCase() === "crypto") {
    redirect("/matrix?tab=crypto");
  }
  if (typeof tabParam === "string" && tabParam.toLowerCase() === "flagship") {
    redirect("/matrix?tab=flagship");
  }
  redirect("/matrix");
}
