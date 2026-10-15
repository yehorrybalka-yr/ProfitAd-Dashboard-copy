import { NextResponse } from "next/server";
import { ingestRnpSnapshot, loadRnpDataset } from "@/lib/rnpIngest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/** Снимок РНП из Neon; force=1 запускает ingest из Google Sheets */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const fromHash = url.searchParams.get("from");

  const dataset = force
    ? (await ingestRnpSnapshot({ force: true, fromHash: fromHash || null })).dataset
    : await loadRnpDataset();

  return NextResponse.json(dataset, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
