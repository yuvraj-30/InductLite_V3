import { NextResponse } from "next/server";
import { processNextExportJob } from "@/lib/export/runner";
import { ensureTestRouteAccess } from "../_guard";

export async function POST(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    const res = await processNextExportJob();
    return NextResponse.json({ success: true, res });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
