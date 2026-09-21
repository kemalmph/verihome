"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isBankTransfer } from "@/lib/payment";

const PACKAGES = {
  basic: { label: "Basic Consultation", price: 99000, duration: "30 min" },
  premium: { label: "Premium Consultation", price: 199000, duration: "60 min" },
} as const;

type PackageId = keyof typeof PACKAGES;

/** Credit a user can actually spend right now. */
export async function getAvailableCredit(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_credits")
    .select("amount, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("redeemed_at", null);

  const now = Date.now();
  return (data ?? [])
    .filter((c) => !c.expires_at || new Date(c.expires_at).getTime() > now)
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);
}

export async function bookConsultation(formData: FormData) {
  const packageId = formData.get("package") as PackageId;
  const propertyId = (formData.get("property_id") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  // A flag, not an amount. The server decides how much credit applies.
  const useCredit = formData.get("use_credit") === "on";

  if (!PACKAGES[packageId]) return { error: "Invalid package selected." };

  const resend = new Resend(process.env.RESEND_API_KEY ?? "dummy");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const pkg = PACKAGES[packageId];
  const admin = createAdminClient();

  // Create consultation row
  const { data: consultation, error: dbError } = await admin
    .from("consultations")
    .insert({
      user_id: user.id,
      property_id: propertyId,
      package_type: packageId,
      price: pkg.price,
      status: "pending_payment",
      notes,
    })
    .select("id")
    .single();

  if (dbError || !consultation) {
    return { error: "Failed to create booking. Please try again." };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // ── Credit, before any payment intent exists ───────────────────────────────
  // The amount comes from the database, inside an advisory lock on the user;
  // this passes a flag only. Redemption and its ledger entries commit together,
  // so credit can never be marked spent without the books recording it.
  let creditApplied = 0;
  let amountDue: number = pkg.price;

  if (useCredit) {
    const { data: creditResult, error: creditError } = await admin
      .rpc("apply_consultation_credit", {
        p_consultation_id: consultation.id,
        p_user_id: user.id,
      });

    if (creditError) {
      return { error: `Kredit tidak dapat dipakai: ${creditError.message}` };
    }

    const row = creditResult?.[0] as
      { applied: number; final_price: number; fully_covered: boolean } | undefined;

    if (row) {
      creditApplied = Number(row.applied ?? 0);
      amountDue     = Number(row.final_price ?? pkg.price);

      // Nothing left to pay means there is nothing to pay with. The RPC has
      // already moved the consultation to paid; issuing an intent for zero
      // would ask the guest to transfer nothing.
      if (row.fully_covered) {
        await resend.emails.send({
          from: "VeriHome <onboarding@resend.dev>",
          to: process.env.TEAM_EMAIL ?? "team@verihome.id",
          subject: `Consultation paid with credit: ${pkg.label}`,
          html: `<p>User ${user.email} booked a <strong>${pkg.label}</strong> fully covered by credit (Rp ${creditApplied.toLocaleString("id-ID")}). Consultation ID: ${consultation.id}.</p>`,
        }).catch(() => null);

        return { fullyCovered: true, creditApplied, consultationId: consultation.id };
      }
    }
  }

  // Same abstraction as bookings and viewing deposits — consultations no longer
  // hardcode a gateway. Which provider runs is PAYMENT_PROVIDER, not this file.
  const provider = getPaymentProvider();
  const intent = await provider.createIntent({
    reference:   consultation.id,
    amount:      amountDue,
    description: `VeriHome ${pkg.label} (${pkg.duration})`,
    payerEmail:  user.email!,
    returnUrl:   `${origin}/consultation/success?id=${consultation.id}`,
    cancelUrl:   `${origin}/consultation?error=payment_failed`,
  });

  // Record whichever reference this provider gave us, so an incoming payment can
  // be matched back: a unique transfer amount, or the gateway's own invoice id.
  await admin
    .from("consultations")
    .update({
      payment_provider:    intent.provider,
      payment_status:      "unpaid",
      bank_transfer_code:  isBankTransfer(intent.action) ? intent.action.transferCode : null,
      payment_external_id: isBankTransfer(intent.action) ? null : intent.action.externalId,
    })
    .eq("id", consultation.id);

  const howToPay = isBankTransfer(intent.action)
    ? `Awaiting bank transfer of Rp ${intent.action.payableAmount.toLocaleString("id-ID")} (code ${intent.action.transferCode}).`
    : `Xendit invoice ${intent.action.externalId} issued.`;

  // Notify team
  await resend.emails.send({
    from: "VeriHome <onboarding@resend.dev>",
    to: process.env.TEAM_EMAIL ?? "team@verihome.id",
    subject: `New consultation booking: ${pkg.label}`,
    html: `<p>User ${user.email} booked a <strong>${pkg.label}</strong>. Consultation ID: ${consultation.id}. ${howToPay}${creditApplied > 0 ? ` Credit applied: Rp ${creditApplied.toLocaleString("id-ID")}.` : ""}</p>`,
  }).catch(() => null);

  return { intent, creditApplied };
}
