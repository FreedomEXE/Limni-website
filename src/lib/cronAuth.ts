export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const vercelCron = request.headers.get("x-vercel-cron");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return (
    headerSecret === secret ||
    querySecret === secret ||
    bearerSecret === secret ||
    vercelCron === "1"
  );
}

