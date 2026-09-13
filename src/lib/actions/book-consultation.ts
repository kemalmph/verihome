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

export async function bookConsultation(formData: FormData) {
  const packageId = formData.get("package") as PackageId;
  const propertyId = (formData.get("property_id") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

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

  // Same abstraction as bookings and viewing deposits — consultations no longer
  // hardcode a gateway. Which provider runs is PAYMENT_PROVIDER, not this file.
  const provider = getPaymentProvider();
  const intent = await provider.createIntent({
    reference:   consultation.id,
    amount:      pkg.price,
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
    html: `<p>User ${user.email} booked a <strong>${pkg.label}</strong>. Consultation ID: ${consultation.id}. ${howToPay}</p>`,
  }).catch(() => null);

  return { intent };
}
