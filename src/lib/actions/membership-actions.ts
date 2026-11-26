"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireAnyPermission } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Memberships and the plans they are sold from.
 *
 * Every function calls requirePermission("sites.operate_all") itself — these are separately
 * addressable POST endpoints, not pages behind a layout (§19.6).
 */

export interface PlanRow {
  id: string;
  site_id: string | null;
  name: string;
  price: number;
  period: string;
  status: string;
  day_passes_per_month: number;
  meeting_room_hours_per_month: number;
  hot_desk_included: boolean;
  discount_pct: number;
  mail_handling: boolean;
  address_use: boolean;
  notes: string | null;
}

export interface MembershipRow {
  id: string;
  membership_code: string;
  plan_name: string | null;
  holder: string;
  company_name: string | null;
  member_contact: string | null;
  starts_on: string;
  ends_on: string;
  price: number;
  period: string;
  status: string;
  payment_status: string;
  contract_ref: string | null;
  day_passes_per_month: number;
  meeting_room_hours_per_month: number;
  hot_desk_included: boolean;
  discount_pct: number;
  /** Consumed this Jakarta month, read from reservations. */
  used_hours: number;
  used_passes: number;
  days_left: number;
}

const txt = (fd: FormData, k: string) => {
  const v = ((fd.get(k) as string) ?? "").trim();
  return v === "" ? null : v;
};
const num = (fd: FormData, k: string, dflt = 0) => {
  const v = ((fd.get(k) as string) ?? "").trim();
  if (v === "") return dflt;
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : dflt;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

export async function listPlans(siteId: string): Promise<PlanRow[]> {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();
  // Plans for this site, plus the ones sold everywhere.
  const { data } = await admin
    .from("membership_plans")
    .select("*")
    .or(`site_id.eq.${siteId},site_id.is.null`)
    .order("price");
  return (data ?? []).map((p) => ({
    ...p,
    price: Number(p.price),
    discount_pct: Number(p.discount_pct),
    meeting_room_hours_per_month: Number(p.meeting_room_hours_per_month),
    day_passes_per_month: Number(p.day_passes_per_month),
  })) as PlanRow[];
}

export async function listMemberships(siteId: string): Promise<MembershipRow[]> {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();

  const { data } = await admin
    .from("memberships")
    .select("*, membership_plans(name)")
    .eq("site_id", siteId)
    .order("ends_on", { ascending: false });

  const rows = data ?? [];
  const today = new Date();
  const jkt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  const todayYmd = jkt(today);

  const out: MembershipRow[] = [];
  for (const m of rows) {
    // Usage comes from the database function, not a stored balance, so it
    // cannot disagree with the bookings it summarises.
    const { data: usage } = await admin.rpc("membership_usage", {
      p_membership_id: m.id,
      p_month: todayYmd,
    });
    const u = Array.isArray(usage) ? usage[0] : usage;

    out.push({
      id: m.id,
      membership_code: m.membership_code,
      plan_name: (m.membership_plans as { name: string } | null)?.name ?? null,
      holder: m.member_name ?? (m.user_id ? "Akun terdaftar" : "—"),
      company_name: m.company_name,
      member_contact: m.member_contact,
      starts_on: m.starts_on,
      ends_on: m.ends_on,
      price: Number(m.price),
      period: m.period,
      status: m.status,
      payment_status: m.payment_status,
      contract_ref: m.contract_ref,
      day_passes_per_month: Number(m.day_passes_per_month),
      meeting_room_hours_per_month: Number(m.meeting_room_hours_per_month),
      hot_desk_included: m.hot_desk_included,
      discount_pct: Number(m.discount_pct),
      used_hours: Number(u?.meeting_room_hours ?? 0),
      used_passes: Number(u?.day_passes ?? 0),
      days_left: Math.round(
        (Date.parse(`${m.ends_on}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / 86400000,
      ),
    });
  }
  return out;
}

export async function createPlan(siteId: string, fd: FormData) {
  try { await requirePermission("sites.operate_all"); } catch (e) { return { error: (e as Error).message }; }
  const admin = createAdminClient();

  const name = txt(fd, "name");
  if (!name) return { error: "Nama paket harus diisi." };

  const period = (fd.get("period") as string) ?? "monthly";
  if (!["monthly", "yearly"].includes(period)) return { error: "Periode tidak dikenal." };

  const discount = num(fd, "discount_pct");
  if (discount < 0 || discount > 100) return { error: "Diskon harus antara 0 dan 100." };

  const { error } = await admin.from("membership_plans").insert({
    site_id: bool(fd, "all_sites") ? null : siteId,
    name,
    price: num(fd, "price"),
    period,
    day_passes_per_month: Math.trunc(num(fd, "day_passes_per_month")),
    meeting_room_hours_per_month: num(fd, "meeting_room_hours_per_month"),
    hot_desk_included: bool(fd, "hot_desk_included"),
    discount_pct: discount,
    mail_handling: bool(fd, "mail_handling"),
    address_use: bool(fd, "address_use"),
    notes: txt(fd, "notes"),
  });
  if (error) return { error: error.message };

  revalidatePath(`/site/${siteId}/members`);
  return { success: true };
}

export async function createMembership(siteId: string, fd: FormData) {
  try { await requirePermission("sites.operate_all"); } catch (e) { return { error: (e as Error).message }; }
  const admin = createAdminClient();

  const member_name = txt(fd, "member_name");
  if (!member_name) return { error: "Nama member harus diisi — member adalah orang, bukan perusahaan." };

  const starts_on = txt(fd, "starts_on");
  const ends_on = txt(fd, "ends_on");
  if (!starts_on || !ends_on) return { error: "Tanggal mulai dan selesai harus diisi." };
  if (ends_on < starts_on) return { error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };

  const plan_id = txt(fd, "plan_id");

  // Entitlements are copied from the plan, not referenced through it: a later
  // edit to the plan must not change what this person bought.
  let snapshot = {
    price: num(fd, "price"),
    period: (fd.get("period") as string) || "monthly",
    day_passes_per_month: 0,
    meeting_room_hours_per_month: 0,
    hot_desk_included: false,
    discount_pct: 0,
    mail_handling: false,
    address_use: false,
  };

  if (plan_id) {
    const { data: plan } = await admin
      .from("membership_plans").select("*").eq("id", plan_id).maybeSingle();
    if (!plan) return { error: "Paket tidak ditemukan." };
    snapshot = {
      price: num(fd, "price") || Number(plan.price),
      period: plan.period,
      day_passes_per_month: Number(plan.day_passes_per_month),
      meeting_room_hours_per_month: Number(plan.meeting_room_hours_per_month),
      hot_desk_included: plan.hot_desk_included,
      discount_pct: Number(plan.discount_pct),
      mail_handling: plan.mail_handling,
      address_use: plan.address_use,
    };
  }

  // Overlap is allowed — an upgrade can legitimately overlap by a day — but
  // the operator should know it is happening rather than find out later.
  const { data: clashes } = await admin
    .from("memberships")
    .select("membership_code, starts_on, ends_on")
    .eq("site_id", siteId)
    .eq("member_name", member_name)
    .in("status", ["pending", "active"])
    .lte("starts_on", ends_on)
    .gte("ends_on", starts_on);

  const code = `MB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36).slice(2, 6).toUpperCase()}`;

  const { data: created, error } = await admin
    .from("memberships")
    .insert({
      membership_code: code,
      site_id: siteId,
      plan_id,
      member_name,
      member_contact: txt(fd, "member_contact"),
      company_name: txt(fd, "company_name"),
      starts_on,
      ends_on,
      status: (fd.get("status") as string) || "pending",
      payment_status: (fd.get("payment_status") as string) || "unpaid",
      contract_ref: txt(fd, "contract_ref"),
      notes: txt(fd, "notes"),
      ...snapshot,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/site/${siteId}/members`);
  return {
    success: true,
    id: created.id,
    warning: (clashes ?? []).length
      ? `${member_name} sudah punya membership aktif yang beririsan (${clashes!
          .map((c) => c.membership_code).join(", ")}). Dibiarkan — perpanjangan memang bisa beririsan.`
      : null,
  };
}

export async function setMembershipStatus(siteId: string, membershipId: string, status: string) {
  try { await requirePermission("sites.operate_all"); } catch (e) { return { error: (e as Error).message }; }
  if (!["pending", "active", "expired", "cancelled"].includes(status)) {
    return { error: "Status tidak dikenal." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("memberships").update({ status }).eq("id", membershipId);
  if (error) return { error: error.message };
  revalidatePath(`/site/${siteId}/members`);
  return { success: true };
}

export async function setMembershipPayment(siteId: string, membershipId: string, payment_status: string) {
  try { await requirePermission("sites.finance_all"); } catch (e) { return { error: (e as Error).message }; }
  if (!["unpaid", "pending_verification", "paid", "refunded"].includes(payment_status)) {
    return { error: "Status pembayaran tidak dikenal." };
  }
  const admin = createAdminClient();

  // Marking it paid posts to the ledger; the other statuses only move the
  // column. The owner decided revenue is recognised per MONTH OF MEMBERSHIP,
  // not per calendar month, so settle_membership_payment builds the schedule
  // anchored to the start date and books the whole fee as a liability —
  // unearned_revenue — releasing one month at a time as each is served.
  //
  // The function also sets payment_status and status, so there is no second
  // update to drift out of step with it. It is idempotent per period: a
  // second press settles nothing and posts nothing.
  if (payment_status === "paid") {
    const { data, error } = await admin.rpc("settle_membership_payment", {
      p_membership_id: membershipId,
    });
    if (error) return { error: error.message };
    revalidatePath(`/site/${siteId}/members`);
    return {
      success: true,
      note: Number(data) > 0
        ? `${data} bulan keanggotaan dicatat sebagai pendapatan diterima di muka.`
        : "Sudah lunas sebelumnya — tidak ada yang diposting ulang.",
    };
  }

  const { error } = await admin.from("memberships").update({ payment_status }).eq("id", membershipId);
  if (error) return { error: error.message };
  revalidatePath(`/site/${siteId}/members`);
  return { success: true };
}
