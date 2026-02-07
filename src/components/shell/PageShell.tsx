import { ReactNode } from "react";

type PageShellProps = {
  header: ReactNode;
  kpis?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
};

export default function PageShell({ header, kpis, tabs, children }: PageShellProps) {
  return (
    <div className="space-y-4">
      <div>{header}</div>
      {kpis ? <div>{kpis}</div> : null}
      {tabs ? <div>{tabs}</div> : null}
      <div>{children}</div>
    </div>
  );
}
