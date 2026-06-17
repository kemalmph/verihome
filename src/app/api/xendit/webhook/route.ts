import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  // Verify Xendit webhook token
  const token = request.headers.get("x-callback-token");
  if (token !== process.env.XENDIT_WEBHOOK_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { external_id: consultationId, status, payer_email } = body;

  if (status !== "PAID") {
    return Response.json({ received: true });
  }

  const admin = createAdminClient();

  const { data: consultation } = await admin
    .from("consultations")
    .update({ status: "paid" })
    .eq("id", consultationId)
    .select("package_type, user_id")
    .single();

  if (!consultation) {
    return new Response("Consultation not found", { status: 404 });
  }

  const packageLabels: Record<string, string> = {
    basic: "Basic (30 min)",
    premium: "Premium (60 min)",
  };
  const packageLabel = packageLabels[consultation.package_type] ?? consultation.package_type;

  // Send booking confirmation to user
  if (payer_email) {
    await resend.emails.send({
      from: "VeriHome <onboarding@resend.dev>",
      to: payer_email,
      subject: "Your consultation is confirmed — VeriHome",
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1b1c1c;">
          <div style="background: #0d2137; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <p style="color: #9cf4d1; font-weight: 700; font-size: 18px; margin: 0;">VeriHome</p>
          </div>
          <div style="background: #fff; padding: 32px; border: 1px solid #cccccc; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #0d2137; margin-top: 0;">Payment received!</h2>
            <p>Your <strong>${packageLabel}</strong> consultation is confirmed.</p>
            <div style="background: #e8f5f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #1a7a5e;"><strong>What's next?</strong></p>
              <p style="margin: 0; font-size: 14px; color: #3e4944;">Our team will contact you within 24 hours to schedule your session via Google Meet or Zoom.</p>
            </div>
            <p style="color: #6e7a74; font-size: 13px;">View your appointment in your <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/appointments" style="color: #1a7a5e;">dashboard</a>.</p>
          </div>
        </div>
      `,
    }).catch(() => null);
  }

  return Response.json({ received: true });
}
