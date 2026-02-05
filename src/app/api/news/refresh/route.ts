import { NextResponse } from "next/server";
import { refreshNewsSnapshot } from "@/lib/news/refresh";

function isAuthorized(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const token = process.env.NEWS_REFRESH_TOKEN;
  const headerToken = request.headers.get("x-news-token");
  const queryToken = url.searchParams.get("token");
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (token) {
    return headerToken === token || queryToken === token;
  }
  if (secret) {
    return querySecret === secret || bearerSecret === secret;
  }
  return true;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await refreshNewsSnapshot();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
