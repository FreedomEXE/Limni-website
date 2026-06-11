/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: InstrumentConfigModal.tsx
 *
 * Description:
 * Per-instrument sizing override editor for a selected matrix row.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getInstrumentSpec,
  type InstrumentSpec,
} from "@/lib/flagship/instrumentDefaults";

type InstrumentConfigModalProps = {
  pair: string;
  assetClass: string;
  spec: InstrumentSpec;
  accountOverrides: Partial<InstrumentSpec> | undefined;
  onSave: (overrides: Partial<InstrumentSpec>) => void;
  onClose: () => void;
};

type FieldConfig = {
  key: keyof InstrumentSpec;
  label: string;
  step: string;
  min?: string;
};

const FIELD_CONFIGS: FieldConfig[] = [
  { key: "contractSize", label: "Contract Size", step: "0.001", min: "0" },
  { key: "pipSize", label: "Pip Size", step: "0.00001", min: "0" },
  { key: "pipValuePerLot", label: "Pip Value / Lot", step: "0.0001", min: "0" },
  { key: "minLot", label: "Min Lot", step: "0.001", min: "0" },
  { key: "maxLot", label: "Max Lot", step: "0.001", min: "0" },
  { key: "lotStep", label: "Lot Step", step: "0.001", min: "0.001" },
  { key: "defaultLeverage", label: "Leverage", step: "1", min: "1" },
  { key: "swapLong", label: "Swap Long", step: "0.01" },
  { key: "swapShort", label: "Swap Short", step: "0.01" },
];

function normalizePair(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toDraftValues(
  pair: string,
  overrides: Partial<InstrumentSpec> | undefined,
): Record<keyof InstrumentSpec, string> {
  const defaults = getInstrumentSpec(pair);
  return {
    pair: normalizePair(pair),
    contractSize: String(overrides?.contractSize ?? defaults.contractSize),
    pipSize: String(overrides?.pipSize ?? defaults.pipSize),
    pipValuePerLot: String(overrides?.pipValuePerLot ?? defaults.pipValuePerLot),
    minLot: String(overrides?.minLot ?? defaults.minLot),
    maxLot: String(overrides?.maxLot ?? defaults.maxLot),
    lotStep: String(overrides?.lotStep ?? defaults.lotStep),
    defaultLeverage: String(overrides?.defaultLeverage ?? defaults.defaultLeverage),
    swapLong: String(overrides?.swapLong ?? defaults.swapLong),
    swapShort: String(overrides?.swapShort ?? defaults.swapShort),
  };
}

export default function InstrumentConfigModal({
  pair,
  assetClass,
  spec,
  accountOverrides,
  onSave,
  onClose,
}: InstrumentConfigModalProps) {
  const normalizedPair = normalizePair(pair);
  const defaultSpec = useMemo(() => getInstrumentSpec(normalizedPair), [normalizedPair]);
  const [draft, setDraft] = useState<Record<keyof InstrumentSpec, string>>(() =>
    toDraftValues(normalizedPair, accountOverrides),
  );

  useEffect(() => {
    setDraft(toDraftValues(normalizedPair, accountOverrides));
  }, [accountOverrides, normalizedPair]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--foreground)]/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Instrument Config
            </p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{normalizedPair}</h2>
            <p className="text-sm text-[color:var(--muted)]">
              {assetClass} · edit local overrides for this account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-3 text-xs text-[color:var(--muted)]">
          <div className="font-semibold text-[var(--foreground)]">Current resolved spec</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <div>Contract {spec.contractSize}</div>
            <div>Pip size {spec.pipSize}</div>
            <div>Pip value / lot {spec.pipValuePerLot}</div>
            <div>Lot range {spec.minLot} - {spec.maxLot}</div>
            <div>Step {spec.lotStep}</div>
            <div>Leverage 1:{spec.defaultLeverage}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {FIELD_CONFIGS.map((field) => {
            const currentValue = draft[field.key];
            const defaultValue = String(defaultSpec[field.key]);
            const isOverridden = currentValue !== defaultValue;

            return (
              <div
                key={field.key}
                className={`rounded-xl border px-3 py-3 ${
                  isOverridden
                    ? "border-[var(--accent)] bg-[var(--accent)]/8"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                      {field.label}
                    </div>
                    <div className="mt-1 text-[10px] text-[color:var(--muted)]">
                      Default {defaultValue}
                    </div>
                  </div>
                  {isOverridden ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((previous) => ({
                          ...previous,
                          [field.key]: defaultValue,
                        }))
                      }
                      className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-strong)]"
                    >
                      Reset to default
                    </button>
                  ) : null}
                </div>
                <input
                  type="number"
                  min={field.min}
                  step={field.step}
                  value={currentValue}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="mt-3 w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const overrides: Partial<InstrumentSpec> = {};
              for (const field of FIELD_CONFIGS) {
                const rawValue = draft[field.key];
                const parsedValue = Number(rawValue);
                const defaultValue = defaultSpec[field.key];
                if (!Number.isFinite(parsedValue) || parsedValue === defaultValue) continue;
                overrides[field.key] = parsedValue as never;
              }
              onSave(overrides);
            }}
            className="rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
