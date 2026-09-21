"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyJobs } from "@/lib/cron/dispatcher";

export interface CronRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  step: string;
  candidates: number;
  succeeded: number;
  failed: number;
  errors: unknown;
}

export async function listCronRuns(limit = 40): Promise<CronRunRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cron_runs")
    .select("id, started_at, finished_at, step, candidates, succeeded, failed, errors")
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CronRunRow[];
}

/**
 * "Jalankan sekarang" — runs the dispatcher on demand.
 *
 * Behind requireAdmin() rather than CRON_SECRET: this is a person clicking a
 * button, not the scheduler. The secret stays the scheduler's credential and is
 * never put in front of a browser.
 */
export async function runDailyJobsNow() {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  try {
    const result = await runDailyJobs();
    revalidatePath("/admin/cron");
    return { success: true, totalFailed: result.totalFailed, steps: result.steps.length };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
