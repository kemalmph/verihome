import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_STEPS, type StepResult } from "./steps";

export interface DispatchResult {
  ranAt: string;
  steps: StepResult[];
  totalFailed: number;
}

/**
 * Runs the daily steps in order, each isolated from the others.
 *
 * Isolation is the point: the old setup was three separate endpoints, so a step
 * that threw simply did not run and nothing recorded that it had not. Here a
 * throwing step is caught, written to cron_runs as failed, and the next step
 * still runs.
 *
 * Order matters — expiry before reminders, so no guest is reminded to pay for a
 * booking that has already released its dates.
 */
export async function runDailyJobs(): Promise<DispatchResult> {
  const admin = createAdminClient();
  const results: StepResult[] = [];

  for (const step of DAILY_STEPS) {
    const startedAt = new Date().toISOString();
    let result: StepResult;

    try {
      result = await step();
    } catch (err) {
      // A step that throws still gets a row. A missing row would be
      // indistinguishable from a step that had nothing to do.
      result = {
        step: step.name,
        candidates: 0, succeeded: 0, failed: 1,
        errors: [{ id: "-", error: (err as Error).message }],
      };
    }

    results.push(result);

    await admin.from("cron_runs").insert({
      started_at:  startedAt,
      finished_at: new Date().toISOString(),
      step:        result.step,
      candidates:  result.candidates,
      succeeded:   result.succeeded,
      failed:      result.failed,
      errors:      result.errors.length || result.notes
        ? { errors: result.errors, notes: result.notes ?? null }
        : [],
    });
  }

  return {
    ranAt: new Date().toISOString(),
    steps: results,
    totalFailed: results.reduce((s, r) => s + r.failed, 0),
  };
}
