"use server";

import Xendit from "xendit-node";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const xendit = new Xendit({ secretKey: process.env.XENDIT_SECRET_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY);

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

  // Create Xendit invoice
  const invoice = await xendit.Invoice.createInvoice({
    data: {
      externalId: consultation.id,
      amount: pkg.price,
      description: `VeriHome ${pkg.label} (${pkg.duration})`,
      payerEmail: user.email!,
      currency: "IDR",
      successRedirectUrl: `${origin}/consultation/success?id=${consultation.id}`,
      failureRedirectUrl: `${origin}/consultation?error=payment_failed`,
      invoiceDuration: 86400, // 24h expiry
    },
  });

  // Save invoice ID
  await admin
    .from("consultations")
    .update({ xendit_invoice_id: invoice.id })
    .eq("id", consultation.id);

  // Notify team
  await resend.emails.send({
    from: "VeriHome <onboarding@resend.dev>",
    to: process.env.TEAM_EMAIL ?? "team@verihome.id",
    subject: `New consultation booking: ${pkg.label}`,
    html: `<p>User ${user.email} booked a <strong>${pkg.label}</strong>. Consultation ID: ${consultation.id}. Invoice: ${invoice.id}.</p>`,
  }).catch(() => null);

  return { invoiceUrl: invoice.invoiceUrl };
}
