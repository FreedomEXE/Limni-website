import DashboardLayout from "@/components/DashboardLayout";
import ResearchLabClient from "@/components/research/ResearchLabClient";

export const dynamic = "force-dynamic";

export default function ResearchLabPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Research Lab</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Build and compare research configurations, run deterministic backtests, and inspect model/symbol/weekday attribution.
          </p>
        </header>
        <ResearchLabClient />
      </div>
    </DashboardLayout>
  );
}
