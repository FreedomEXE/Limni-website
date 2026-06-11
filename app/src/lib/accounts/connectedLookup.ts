import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function decodeAccountKeyCandidates(rawParam: string) {
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const decodedOnce = decodeSafe(rawParam);
  const decodedTwice = decodeSafe(decodedOnce);

  return Array.from(
    new Set(
      [
        rawParam,
        decodedOnce,
        decodedTwice,
        rawParam ? rawParam.replace(/%3A/gi, ":") : "",
        decodedOnce ? decodedOnce.replace(/%3A/gi, ":") : "",
      ].filter((value) => Boolean(value && value.trim())),
    ),
  );
}

export async function findConnectedAccountByCandidates(candidates: string[]) {
  for (const candidate of candidates) {
    const account = await getConnectedAccount(candidate);
    if (account) {
      return account;
    }
  }

  const all = await listConnectedAccounts();
  const normalizedCandidates = new Set(candidates.map(normalize));
  const idCandidates = new Set(
    candidates
      .flatMap((value) => {
        if (value.includes(":")) {
          const [, ...rest] = value.split(":");
          return [rest.join(":"), value];
        }
        return [value];
      })
      .map(normalize),
  );

  return (
    all.find((item) => normalizedCandidates.has(normalize(item.account_key))) ??
    all.find((item) =>
      normalizedCandidates.has(normalize(`${item.provider}:${item.account_id ?? ""}`)),
    ) ??
    all.find((item) => idCandidates.has(normalize(item.account_id ?? ""))) ??
    null
  );
}
