import { NextResponse } from "next/server";
import { processNextExportJob } from "@/lib/export/runner";

export async function POST(req: Request) {
  const allowedHeader = req.headers.get("x-test-runner");
  if (
    process.env.NODE_ENV !== "test" &&
    process.env.ALLOW_TEST_RUNNER !== "1" &&
    allowedHeader !== (process.env.TEST_RUNNER_TOKEN || "1")
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

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
