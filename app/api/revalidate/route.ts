import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { RNP_CACHE_TAG } from "@/lib/rnpConfig";

/**
 * On-demand инвалидация кэша РНП.
 *
 * Вызов из Google Apps Script при изменении таблицы:
 *   UrlFetchApp.fetch('https://YOUR-APP.vercel.app/api/revalidate?secret=YOUR_SECRET', { method: 'POST' });
 *
 * На Vercel задайте env: REVALIDATE_SECRET=случайная_строка
 */
export async function POST(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-revalidate-secret");

  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(RNP_CACHE_TAG);

  const { ingestRnpSnapshot } = await import("@/lib/rnpIngest");
  const result = await ingestRnpSnapshot({ force: true });

  return NextResponse.json({
    revalidated: true,
    tag: RNP_CACHE_TAG,
    accepted: result.accepted,
    reason: result.reason,
    at: new Date().toISOString(),
  });
}
