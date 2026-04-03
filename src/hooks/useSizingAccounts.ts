/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: useSizingAccounts.ts
 *
 * Description:
 * Client-side sizing account state backed by localStorage.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";

import type { InstrumentSpec } from "@/lib/flagship/instrumentDefaults";
import {
  createDefaultAccount,
  type SizingAccount,
} from "@/lib/flagship/positionSizer";

const ACCOUNTS_KEY = "limni-sizing-accounts";
const ACTIVE_ACCOUNT_KEY = "limni-sizing-active-account";

function normalizePair(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseAccounts(raw: string | null): SizingAccount[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<SizingAccount>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.balance !== "number" ||
        typeof candidate.currency !== "string" ||
        typeof candidate.riskPctPerTrade !== "number" ||
        typeof candidate.leverage !== "number" ||
        typeof candidate.maxPortfolioHeatPct !== "number" ||
        candidate.instrumentOverrides === null ||
        typeof candidate.instrumentOverrides !== "object"
      ) {
        return [];
      }

      return [{
        id: candidate.id,
        name: candidate.name,
        balance: candidate.balance,
        currency: candidate.currency,
        riskPctPerTrade: candidate.riskPctPerTrade,
        leverage: candidate.leverage,
        maxPortfolioHeatPct: candidate.maxPortfolioHeatPct,
        scaleFactor:
          typeof candidate.scaleFactor === "number" && Number.isFinite(candidate.scaleFactor)
            ? candidate.scaleFactor
            : 0.2,
        instrumentOverrides: candidate.instrumentOverrides,
      } satisfies SizingAccount];
    });
  } catch {
    return [];
  }
}

export function useSizingAccounts(): {
  accounts: SizingAccount[];
  activeAccount: SizingAccount | null;
  activeAccountId: string | null;
  setActiveAccountId: (id: string) => void;
  addAccount: (name: string) => SizingAccount;
  updateAccount: (id: string, updates: Partial<SizingAccount>) => void;
  deleteAccount: (id: string) => void;
  updateInstrumentOverride: (accountId: string, pair: string, overrides: Partial<InstrumentSpec>) => void;
  clearInstrumentOverride: (accountId: string, pair: string) => void;
} {
  const [accounts, setAccounts] = useState<SizingAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedAccounts = parseAccounts(window.localStorage.getItem(ACCOUNTS_KEY));
      const storedActiveId = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);

      if (storedAccounts.length === 0) {
        const defaultAccount = createDefaultAccount("Default");
        setAccounts([defaultAccount]);
        setActiveAccountIdState(defaultAccount.id);
        setHydrated(true);
        return;
      }

      const nextActiveId =
        storedActiveId && storedAccounts.some((account) => account.id === storedActiveId)
          ? storedActiveId
          : storedAccounts[0]?.id ?? null;

      setAccounts(storedAccounts);
      setActiveAccountIdState(nextActiveId);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    if (activeAccountId) {
      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeAccountId);
    } else {
      window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  }, [accounts, activeAccountId, hydrated]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  function setActiveAccountId(id: string) {
    setActiveAccountIdState(id);
  }

  function addAccount(name: string) {
    const trimmed = name.trim();
    const account = createDefaultAccount(trimmed || `Account ${accounts.length + 1}`);
    setAccounts((previous) => [...previous, account]);
    setActiveAccountIdState(account.id);
    return account;
  }

  function updateAccount(id: string, updates: Partial<SizingAccount>) {
    setAccounts((previous) =>
      previous.map((account) =>
        account.id === id
          ? {
              ...account,
              ...updates,
              instrumentOverrides: updates.instrumentOverrides ?? account.instrumentOverrides,
            }
          : account,
      ),
    );
  }

  function deleteAccount(id: string) {
    setAccounts((previous) => {
      const next = previous.filter((account) => account.id !== id);
      setActiveAccountIdState((current) => {
        if (current !== id) return current;
        return next[0]?.id ?? null;
      });
      return next;
    });
  }

  function clearInstrumentOverride(accountId: string, pair: string) {
    const normalizedPair = normalizePair(pair);
    setAccounts((previous) =>
      previous.map((account) => {
        if (account.id !== accountId) return account;
        const nextOverrides = { ...account.instrumentOverrides };
        delete nextOverrides[normalizedPair];
        return {
          ...account,
          instrumentOverrides: nextOverrides,
        };
      }),
    );
  }

  function updateInstrumentOverride(accountId: string, pair: string, overrides: Partial<InstrumentSpec>) {
    const normalizedPair = normalizePair(pair);
    const cleanedOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null),
    ) as Partial<InstrumentSpec>;

    if (Object.keys(cleanedOverrides).length === 0) {
      clearInstrumentOverride(accountId, normalizedPair);
      return;
    }

    setAccounts((previous) =>
      previous.map((account) => {
        if (account.id !== accountId) return account;
        return {
          ...account,
          instrumentOverrides: {
            ...account.instrumentOverrides,
            [normalizedPair]: cleanedOverrides,
          },
        };
      }),
    );
  }

  return {
    accounts,
    activeAccount,
    activeAccountId,
    setActiveAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    updateInstrumentOverride,
    clearInstrumentOverride,
  };
}
