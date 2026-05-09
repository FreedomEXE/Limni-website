import Image from "next/image";

export default function LimniLoading({
  label = "Loading...",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-20 w-20" : "h-28 w-28";
  const iconSize = compact ? 50 : 68;

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-6 py-10"
      style={{ background: "var(--background, #f8f7f2)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={`relative ${sizeClass}`}>
          <div
            className="absolute inset-0 rounded-full border-2 shadow-[0_0_28px_rgba(16,185,129,0.24)] animate-spin"
            style={{
              borderColor: "var(--panel-border, #d8d4ca)",
              borderTopColor: "var(--accent, #0f766e)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-2 rounded-full border"
            style={{
              animation: "spin 1.8s linear infinite reverse",
              borderColor: "var(--panel-border, #d8d4ca)",
              borderBottomColor: "var(--accent, #0f766e)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-4 flex items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--panel, #ffffff) 95%, transparent)" }}
          >
            <Image
              src="/limni-icon.svg"
              alt="Limni loading"
              width={iconSize}
              height={iconSize}
              className="select-none logo-theme-aware"
              style={{ animation: "spin 2.2s linear infinite" }}
              priority
            />
          </div>
        </div>
        <p
          className="text-xs uppercase tracking-[0.25em]"
          style={{ color: "var(--muted, #6b7280)" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
