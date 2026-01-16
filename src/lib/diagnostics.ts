export type StatusIssue = {
  severity: "error" | "warning";
  title: string;
  details?: string;
  hint?: string;
};

type DiagnosticsOptions = {
  dbError?: string | null;
  priceError?: string | null;
  sentimentError?: string | null;
  accountsError?: string | null;
};

function sanitizeError(error?: string | null) {
  if (!error) {
    return "";
  }
  return error.replace(/(postgresql:\/\/)([^@]+)@/i, "$1***@");
}

function getDatabaseHost(value: string) {
  try {
    const url = new URL(value);
    return url.host;
  } catch {
    return "";
  }
}

export function getAppDiagnostics(options: DiagnosticsOptions = {}): StatusIssue[] {
  const issues: StatusIssue[] = [];
  const dbUrl = process.env.DATABASE_URL ?? "";
  const priceKey = process.env.PRICE_API_KEY ?? "";
  const adminToken = process.env.ADMIN_TOKEN ?? "";
  const mt5Token = process.env.MT5_PUSH_TOKEN ?? "";

  if (!dbUrl) {
    issues.push({
      severity: "error",
      title: "DATABASE_URL missing",
      details: "Server cannot connect to PostgreSQL without DATABASE_URL.",
      hint: "Set DATABASE_URL in Vercel to the Render external connection string.",
    });
  } else {
    const host = getDatabaseHost(dbUrl);
    if (!host) {
      issues.push({
        severity: "error",
        title: "DATABASE_URL invalid",
        details: "DATABASE_URL could not be parsed.",
        hint: "Paste the full Render connection string (postgresql://...).",
      });
    } else if (!host.includes(".")) {
      issues.push({
        severity: "warning",
        title: "DATABASE_URL host looks internal",
        details: `Host is "${host}". External hosts include a domain.`,
        hint: "Use the Render external host in Vercel (not internal).",
      });
    }
  }

  if (!priceKey) {
    issues.push({
      severity: "warning",
      title: "PRICE_API_KEY missing",
      details: "Price performance refresh is disabled.",
      hint: "Add PRICE_API_KEY to Vercel (TwelveData).",
    });
  }

  if (!adminToken) {
    issues.push({
      severity: "warning",
      title: "ADMIN_TOKEN missing",
      details: "Manual refresh endpoints will reject requests.",
      hint: "Set ADMIN_TOKEN in Vercel.",
    });
  }

  if (!mt5Token && !adminToken) {
    issues.push({
      severity: "warning",
      title: "MT5 push token missing",
      details: "MT5 snapshot pushes may be rejected.",
      hint: "Set MT5_PUSH_TOKEN or reuse ADMIN_TOKEN.",
    });
  }

  const hasIg =
    (process.env.IG_API_KEY ?? "") &&
    (process.env.IG_USERNAME ?? "") &&
    (process.env.IG_PASSWORD ?? "");
  const hasOanda = Boolean(process.env.OANDA_API_KEY ?? "");
  const hasMyfxbook =
    (process.env.MYFXBOOK_EMAIL ?? "") &&
    (process.env.MYFXBOOK_PASSWORD ?? "");
  const hasScraper = Boolean(process.env.SCRAPER_URL ?? "");
  if (!hasIg && !hasOanda && !hasMyfxbook && !hasScraper) {
    issues.push({
      severity: "warning",
      title: "Sentiment providers not configured",
      details: "No IG, OANDA, Myfxbook, or scraper credentials found.",
      hint: "Add at least one provider set in Vercel env vars.",
    });
  }

  if (options.dbError) {
    issues.push({
      severity: "error",
      title: "Database query failed",
      details: sanitizeError(options.dbError),
      hint: "Confirm DATABASE_URL and Render SSL settings.",
    });
  }

  if (options.priceError) {
    issues.push({
      severity: "warning",
      title: "Price performance unavailable",
      details: sanitizeError(options.priceError),
      hint: "Check PRICE_API_KEY and API quota.",
    });
  }

  if (options.sentimentError) {
    issues.push({
      severity: "warning",
      title: "Sentiment data unavailable",
      details: sanitizeError(options.sentimentError),
      hint: "Check provider credentials and refresh endpoint.",
    });
  }

  if (options.accountsError) {
    issues.push({
      severity: "warning",
      title: "Account data unavailable",
      details: sanitizeError(options.accountsError),
      hint: "Check MT5 push and database connectivity.",
    });
  }

  return issues;
}
