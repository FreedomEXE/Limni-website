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
            Phase 1A shell: configure and run deterministic backtests through the new Research API.
          </p>
        </header>
        <ResearchLabClient />
      </div>
    </DashboardLayout>
  );
}
