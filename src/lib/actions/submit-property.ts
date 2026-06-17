"use server";

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function submitProperty(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const area = formData.get("area") as string;
  const property_type = formData.get("property_type") as string;
  const bedrooms = formData.get("bedrooms") as string;
  const bathrooms = parseInt(formData.get("bathrooms") as string) || 1;
  const price_monthly = parseInt(formData.get("price_monthly") as string);
  const description = (formData.get("description") as string)?.trim();
  const owner_name = (formData.get("owner_name") as string)?.trim();
  const owner_email = (formData.get("owner_email") as string)?.trim();
  const owner_phone = (formData.get("owner_phone") as string)?.trim();

  if (!name || !area || !property_type || !price_monthly || !owner_name || !owner_email || !owner_phone) {
    return { error: "Please fill in all required fields." };
  }

  const validTypes = ["kost", "apartment", "house"];
  const resolvedType = validTypes.includes(property_type) ? property_type : "apartment";

  const bedroomMap: Record<string, number> = { studio: 0, "1": 1, "2": 2, "3": 3, "4+": 4 };
  const bedroomsNum = bedroomMap[bedrooms] ?? 1;

  const supabase = createAdminClient();

  // Upsert owner by email
  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .upsert(
      { name: owner_name, email: owner_email, phone_whatsapp: owner_phone, verification_status: "pending", cooperation_status: "pending" },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  if (ownerError || !owner) {
    return { error: "Failed to save owner details. Please try again." };
  }

  // Generate unique slug
  const baseSlug = slugify(name);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { error: propError } = await supabase.from("properties").insert({
    name,
    slug,
    property_type: resolvedType,
    status: "unverified",
    submission_type: "owner",
    price_monthly,
    area,
    bedrooms: bedroomsNum,
    bathrooms,
    owner_id: owner.id,
  });

  if (propError) {
    return { error: "Failed to save property. Please try again." };
  }

  // Insert property details with description as notes
  if (description) {
    await supabase.from("property_details").insert({
      property_id: (
        await supabase.from("properties").select("id").eq("slug", slug).single()
      ).data?.id,
      additional_notes: description,
      included_utilities: [],
      facilities: [],
    });
  }

  // Send emails (fire and forget — don't fail the submission if email fails)
  const resend = new Resend(process.env.RESEND_API_KEY ?? "dummy");
  const emailFrom = "VeriHome <onboarding@resend.dev>";

  await Promise.allSettled([
    // Confirmation to owner
    resend.emails.send({
      from: emailFrom,
      to: owner_email,
      subject: "We received your property submission — VeriHome",
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1b1c1c;">
          <div style="background: #0d2137; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <p style="color: #9cf4d1; font-weight: 700; font-size: 18px; margin: 0;">VeriHome</p>
          </div>
          <div style="background: #fff; padding: 32px; border: 1px solid #cccccc; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #0d2137; margin-top: 0;">Thanks, ${owner_name}!</h2>
            <p>We've received your submission for <strong>${name}</strong> in <strong>${area}</strong>.</p>
            <p>Our team will review your listing and reach out within <strong>2 business days</strong> to schedule a Rental Lifestyle Audit (RLA).</p>
            <div style="background: #e8f5f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; font-size: 14px; color: #1a7a5e;"><strong>What happens next?</strong></p>
              <ol style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: #3e4944;">
                <li>VeriHome conducts an in-person RLA inspection</li>
                <li>We photograph and document the property</li>
                <li>Your listing goes live on the marketplace</li>
              </ol>
            </div>
            <p style="color: #6e7a74; font-size: 13px;">Questions? Reply to this email or WhatsApp us at +62 812-VERI-HOME.</p>
          </div>
        </div>
      `,
    }),

    // Internal notification to VeriHome team
    resend.emails.send({
      from: emailFrom,
      to: process.env.TEAM_EMAIL ?? "team@verihome.id",
      subject: `New property submission: ${name} (${area})`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2>New Owner Submission</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 8px; color: #6e7a74; border-bottom: 1px solid #eee;">Property</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">${name}</td></tr>
            <tr><td style="padding: 8px; color: #6e7a74; border-bottom: 1px solid #eee;">Area</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${area}</td></tr>
            <tr><td style="padding: 8px; color: #6e7a74; border-bottom: 1px solid #eee;">Type</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-transform: capitalize;">${resolvedType}</td></tr>
            <tr><td style="padding: 8px; color: #6e7a74; border-bottom: 1px solid #eee;">Price</td><td style="padding: 8px; border-bottom: 1px solid #eee;">IDR ${price_monthly.toLocaleString("id-ID")}/mo</td></tr>
            <tr><td style="padding: 8px; color: #6e7a74; border-bottom: 1px solid #eee;">Owner</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${owner_name}</td></tr>
            <tr><td style="padding: 8px; color: #6e7a74; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${owner_email}</td></tr>
            <tr><td style="padding: 8px; color: #6e7a74;">WhatsApp</td><td style="padding: 8px;">${owner_phone}</td></tr>
          </table>
          ${description ? `<p style="margin-top: 16px; font-size: 14px; color: #3e4944;"><strong>Notes:</strong> ${description}</p>` : ""}
        </div>
      `,
    }),
  ]);

  return { success: true };
}
