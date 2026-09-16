import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { runIntegrityChecks } from "@/lib/ledger/integrity";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const result = await runIntegrityChecks();
  // A failing check is a real finding, not a server error — 200 with the
  // detail, so a monitor reads the body rather than guessing from a status.
  return NextResponse.json(result);
}
