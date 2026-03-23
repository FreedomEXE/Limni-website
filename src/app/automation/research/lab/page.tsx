import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ResearchLabPage() {
  redirect("/automation/research");
}
