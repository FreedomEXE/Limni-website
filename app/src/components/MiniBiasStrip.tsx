"use client";

type BiasItem = {
  id: string;
  label: string;
  bias: string;
};

type MiniBiasStripProps = {
  items: BiasItem[];
};

function biasTone(bias: string) {
  if (bias === "BULLISH") {
    return "bg-emerald-500";
  }
  if (bias === "BEARISH") {
    return "bg-rose-500";
  }
  return "bg-[var(--panel-border)]/60";
}

export default function MiniBiasStrip({ items }: MiniBiasStripProps) {
  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No data yet.</p>;
  }

  return (
    <div className="grid grid-cols-8 gap-2 md:grid-cols-12 xl:grid-cols-16">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white ${biasTone(
            item.bias,
          )}`}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
