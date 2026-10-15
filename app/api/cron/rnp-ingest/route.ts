import { NextResponse } from "next/server";
import { ingestRnpSnapshot } from "@/lib/rnpIngest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (cronSecret && querySecret === cronSecret) return true;
  if (revalidateSecret && querySecret === revalidateSecret) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (!cronSecret && !revalidateSecret && process.env.NODE_ENV !== "production") {
    return true;
  }
  return false;
}

/** Vercel Cron: каждые 10 минут забирает CSV, проверяет качество, пишет снимок в Neon */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestRnpSnapshot();
    return NextResponse.json({
      ok: true,
      accepted: result.accepted,
      reason: result.reason,
      months: result.dataset.months.length,
      hash: result.dataset.contentHash,
      warnings: result.dataset.health?.warnings ?? [],
      fetchedAt: result.dataset.fetchedAt,
    });
  } catch (error) {
    console.error("[cron rnp-ingest]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ingest failed",
      },
      { status: 500 },
    );
  }
}
