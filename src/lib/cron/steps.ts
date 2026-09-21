import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The four daily jobs, each reporting what it actually did.
 *
 * The old endpoints returned `{ expired: 0 }` whether nothing was due or every
 * row had failed — a total failure and a quiet night produced identical output,
 * which is how booking expiry stayed broken for months (§18.9). Every step here
 * returns candidates / succeeded / failed separately, so those two cases can
 * never look the same again.
 */
export interface StepResult {
  step: string;
  /** Rows that were eligible for this step before any work was attempted. */
  candidates: number;
  succeeded: number;
  failed: number;
  errors: { id: string; error: string }[];
  /** Anything worth surfacing that is not an error. */
  notes?: Record<string, unknown>;
}

const empty = (step: string): StepResult =>
  ({ step, candidates: 0, succeeded: 0, failed: 0, errors: [] });

// ── 1. Release dates held by unpaid bookings past their deadline ─────────────
export async function expireStaleBookings(): Promise<StepResult> {
  const admin = createAdminClient();
  const r = empty("expire-bookings");

  const { data, error } = await admin
    .from("bookings")
    .select("id")
    .eq("payment_status", "unpaid")
    .not("status", "in", '("confirmed","cancelled","expired","completed")')
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  if (error) {
    r.failed = 1;
    r.errors.push({ id: "-", error: `fetch failed: ${error.message}` });
    return r;
  }

  r.candidates = data?.length ?? 0;

  for (const { id } of data ?? []) {
    const { data: ok, error: e } = await admin.rpc("expire_single_booking", { p_booking_id: id });
    if (e) { r.failed++; r.errors.push({ id, error: e.message }); }
    else if (ok === true) r.succeeded++;
    // ok === false means someone paid or cancelled it first: not a failure.
  }

  return r;
}

// ── 2. Recognise revenue for stays that have finished ───────────────────────
export async function completeDueBookings(): Promise<StepResult> {
  const admin = createAdminClient();
  const r = empty("complete-bookings");
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("bookings")
    .select("id, booking_code")
    .eq("status", "confirmed")
    .lte("check_out_date", today);

  if (error) {
    r.failed = 1;
    r.errors.push({ id: "-", error: `fetch failed: ${error.message}` });
    return r;
  }

  r.candidates = data?.length ?? 0;
  const unsplit: string[] = [];

  // One booking at a time: a failure on one must not stop the rest, and must
  // not leave that booking completed with no revenue recognised. The RPC keeps
  // each row and its entries in the same transaction.
  for (const b of data ?? []) {
    const { data: outcome, error: e } = await admin.rpc("settle_booking_completion", {
      p_booking_id: b.id, p_actor: null,
    });
    if (e) { r.failed++; r.errors.push({ id: b.booking_code ?? b.id, error: e.message }); continue; }

    const o = outcome as { completed?: boolean; split?: boolean } | null;
    if (o?.completed) r.succeeded++;
    if (o?.completed && o.split === false) unsplit.push(b.booking_code ?? b.id);
  }

  // Revenue booked entirely to the owner because no commission rate applied.
  if (unsplit.length) r.notes = { unsplit };
  return r;
}

// ── 3. Reminders ────────────────────────────────────────────────────────────
export async function sendDueReminders(): Promise<StepResult> {
  const admin = createAdminClient();
  const r = empty("send-reminders");
  const now = Date.now();

  const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10);

  const [{ data: checkins }, { data: expiring }] = await Promise.all([
    admin
      .from("bookings")
      .select("id, booking_code, user_id, check_in_date, checkin_reminder_sent_at")
      .eq("status", "confirmed")
      .eq("check_in_date", tomorrow)
      .is("checkin_reminder_sent_at", null),
    admin
      .from("bookings")
      .select("id, booking_code, user_id, expires_at, expiry_reminder_sent_at")
      .eq("payment_status", "unpaid")
      .not("status", "in", '("confirmed","cancelled","expired","completed")')
      .is("expiry_reminder_sent_at", null)
      .not("expires_at", "is", null)
      .gt("expires_at", new Date(now + 12 * 3_600_000).toISOString())
      .lt("expires_at", new Date(now + 36 * 3_600_000).toISOString()),
  ]);

  r.candidates = (checkins?.length ?? 0) + (expiring?.length ?? 0);

  // No delivery provider is connected yet. The stamps are deliberately NOT
  // written here: marking a reminder sent when nothing was sent would make the
  // gap permanent and invisible, which is worse than not sending.
  r.notes = {
    delivery: "not_connected",
    checkin_due: checkins?.length ?? 0,
    payment_due: expiring?.length ?? 0,
  };

  return r;
}

// ── 4. Expire credit nobody spent ───────────────────────────────────────────
export async function expireLapsedCredits(): Promise<StepResult> {
  const admin = createAdminClient();
  const r = empty("expire-credits");

  const { data, error } = await admin
    .from("user_credits")
    .select("id, user_id, amount, viewing_id")
    .eq("status", "active")
    .is("redeemed_at", null)
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  if (error) {
    r.failed = 1;
    r.errors.push({ id: "-", error: `fetch failed: ${error.message}` });
    return r;
  }

  r.candidates = data?.length ?? 0;

  for (const c of data ?? []) {
    const { error: e } = await admin.rpc("expire_single_credit", { p_credit_id: c.id });
    if (e) { r.failed++; r.errors.push({ id: c.id, error: e.message }); }
    else r.succeeded++;
  }

  return r;
}

export const DAILY_STEPS = [
  // Order matters: expire before reminding, so nobody is reminded about a
  // booking that is already dead.
  expireStaleBookings,
  completeDueBookings,
  sendDueReminders,
  expireLapsedCredits,
] as const;
