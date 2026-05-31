import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const segments = params.path ?? [];
  const [version, ...assetPath] = segments;

  if (!version || !/^v\d+(?:\.\d+)*$/.test(version) || assetPath.length < 2) {
    return NextResponse.json({ error: "Invalid release asset path" }, { status: 400 });
  }

  if (assetPath[0] !== "screenshots") {
    return NextResponse.json({ error: "Only release screenshots are public assets" }, { status: 403 });
  }

  const extension = path.extname(assetPath[assetPath.length - 1]).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[extension];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported release asset type" }, { status: 415 });
  }

  const releaseRoot = path.resolve(process.cwd(), "releases", version);
  const target = path.resolve(releaseRoot, ...assetPath);
  if (!target.startsWith(`${releaseRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid release asset path" }, { status: 400 });
  }

  try {
    const bytes = await readFile(target);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Release asset not found" }, { status: 404 });
  }
}
