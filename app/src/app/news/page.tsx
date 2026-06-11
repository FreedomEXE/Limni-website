/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Weekly news page backed by a server-built payload and client-side week switching.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import DashboardLayout from "@/components/DashboardLayout";
import NewsPageClient from "@/components/news/NewsPageClient";
import { loadNewsPayload } from "@/lib/news/loadNewsPayload";

export const revalidate = 60;
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const payload = await loadNewsPayload(pickParam(params?.week));

  return (
    <DashboardLayout>
      <NewsPageClient initialPayload={payload} />
    </DashboardLayout>
  );
}
