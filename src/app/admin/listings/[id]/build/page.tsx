import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkPendingImport } from "@/lib/actions/survey-actions";
import { BuildListingPageClient } from "./BuildListingPageClient";

interface BuildListingPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function BuildListingPage({ params }: BuildListingPageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: property }, { data: pendingImports }] = await Promise.all([
    admin
      .from("properties")
      .select(`
        id, name, area, address, property_type, price_monthly,
        bedrooms, bathrooms, size_sqm, min_stay_months, google_maps_url, status,
        rla_assessments ( building_condition, natural_lighting, ventilation, noise_level, cleanliness, security_level, bathroom_condition, furniture_quality, pros, cons, overall_notes, survey_id ),
        area_overviews ( nearest_mrt, mrt_distance, nearest_transjakarta, transjakarta_distance, nearest_minimarket, nearest_clinic, nearest_food, nearest_gym, neighborhood_character, expat_friendly, time_to_scbd_min, time_to_sudirman_min, area_notes ),
        property_details ( facilities, included_utilities, rules, additional_notes )
      `)
      .eq("id", id)
      .single(),
    admin
      .from("pending_survey_imports")
      .select("id, tally_submission_id, property_name_text, created_at, raw_payload")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (!property) notFound();

  const rlaRows = (property.rla_assessments ?? []) as {
    building_condition: number | null;
    natural_lighting: number | null;
    ventilation: number | null;
    noise_level: number | null;
    cleanliness: number | null;
    security_level: number | null;
    bathroom_condition: number | null;
    furniture_quality: number | null;
    pros: string[];
    cons: string[];
    overall_notes: string | null;
    survey_id: string | null;
  }[];

  const rla = rlaRows.find((r) => r.survey_id === null) ?? rlaRows[0] ?? null;

  const area = (property.area_overviews?.[0] ?? null) as {
    nearest_mrt: string | null;
    mrt_distance: string | null;
    nearest_transjakarta: string | null;
    transjakarta_distance: string | null;
    nearest_minimarket: string | null;
    nearest_clinic: string | null;
    nearest_food: string | null;
    nearest_gym: string | null;
    neighborhood_character: string | null;
    expat_friendly: number | null;
    time_to_scbd_min: number | null;
    time_to_sudirman_min: number | null;
    area_notes: string | null;
  } | null;

  const details = (property.property_details?.[0] ?? null) as {
    facilities: string[];
    included_utilities: string[];
    rules: string | null;
    additional_notes: string | null;
  } | null;

  // Pre-parse pending import display data server-side
  const parsedPending = (pendingImports ?? []).map((item) => {
    const rawFields =
      (item.raw_payload as { data?: { fields?: { label: string; value: unknown }[] } })
        ?.data?.fields ?? [];
    const fieldMap = Object.fromEntries(rawFields.map((f) => [f.label, f.value]));
    return {
      id: item.id,
      tally_submission_id: item.tally_submission_id,
      property_name_text: item.property_name_text,
      created_at: item.created_at,
      surveyor: String(fieldMap["Nama Surveyor"] ?? fieldMap["Surveyor"] ?? "—"),
      date: String(fieldMap["Tanggal"] ?? fieldMap["Date"] ?? "—"),
    };
  });

  async function handleLinkImport(pendingId: string) {
    "use server";
    await linkPendingImport(pendingId, id);
  }

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/listings" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12 max-w-[1100px]">
        <BuildListingPageClient
          property={{
            id: property.id,
            name: property.name,
            area: property.area,
            address: property.address,
            property_type: property.property_type,
            price_monthly: property.price_monthly,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            size_sqm: property.size_sqm ? Number(property.size_sqm) : null,
            min_stay_months: property.min_stay_months,
            google_maps_url: property.google_maps_url,
            status: property.status ?? "new_lead",
          }}
          rla={rla}
          area={area}
          details={details}
          pendingImports={parsedPending}
          onLinkImport={handleLinkImport}
        />
      </main>
    </div>
  );
}
