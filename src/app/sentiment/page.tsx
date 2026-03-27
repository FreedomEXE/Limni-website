/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: sentiment/page.tsx
 *
 * Description:
 * Redirect shim — sentiment now lives on /dashboard?bias=sentiment.
 * This preserves backward compatibility for bookmarks and shared links.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SentimentRedirectProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SentimentRedirect({ searchParams }: SentimentRedirectProps) {
  const resolved = (await Promise.resolve(searchParams)) ?? {};
  const params = new URLSearchParams();
  params.set("bias", "sentiment");
  const asset = Array.isArray(resolved.asset) ? resolved.asset[0] : resolved.asset;
  if (asset) params.set("asset", asset);
  const view = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view;
  if (view) params.set("view", view);
  redirect(`/dashboard?${params.toString()}`);
}
