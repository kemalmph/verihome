import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/app/admin/listings/StatusSelect";
import { linkPendingImport } from "@/lib/actions/survey-actions";
import { BuildListingForm } from "./BuildListingForm";

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

  // Prefer manually created RLA (no survey_id) so manual edits don't overwrite Tally imports
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

  const allPending = pendingImports ?? [];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/listings" />
      <main className="flex-1 ml-64 p-12 max-w-[1100px]">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#3e4944] mb-2">
            <Link href="/admin/listings" className="hover:text-[#1a7a5e]">Listings</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <Link href={`/admin/listings/${id}`} className="hover:text-[#1a7a5e]">{property.name}</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-[#1b1c1c] font-medium">Build Listing</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0d2137]">{property.name}</h1>
            <StatusBadge status={property.status ?? "new_lead"} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Left: main form */}
          <div className="lg:col-span-2">
            <BuildListingForm
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
              }}
              rla={rla}
              area={area}
              details={details}
            />
          </div>

          {/* Right: Tally import panel */}
          <div className="space-y-4 sticky top-8">
            <div className="bg-[#0d2137] text-white rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#9cf4d1]">bolt</span>
                <h3 className="font-bold">Import from Tally</h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                If the surveyor submitted the Tally form, import it here instead of filling in manually. The RLA scores, area overview, and notes will be populated automatically.
              </p>

              {allPending.length === 0 ? (
                <div className="bg-white/5 rounded-lg p-4 text-sm text-white/50 text-center">
                  No pending Tally submissions.<br />
                  <span className="text-xs">They appear here automatically after the surveyor submits the form.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {allPending.map((item) => {
                    const rawFields =
                      (item.raw_payload as { data?: { fields?: { label: string; value: unknown }[] } })
                        ?.data?.fields ?? [];
                    const fieldMap = Object.fromEntries(rawFields.map((f) => [f.label, f.value]));
                    const surveyor = String(fieldMap["Nama Surveyor"] ?? fieldMap["Surveyor"] ?? "—");
                    const date     = String(fieldMap["Tanggal"] ?? fieldMap["Date"] ?? "—");

                    async function handleLink() {
                      "use server";
                      await linkPendingImport(item.id, id);
                    }

                    return (
                      <div key={item.id} className="bg-white/10 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-xs text-white/50">Property typed by surveyor</p>
                          <p className="text-sm font-semibold text-white">&ldquo;{item.property_name_text}&rdquo;</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                          <span>Surveyor: <strong className="text-white/80">{surveyor}</strong></span>
                          <span>Date: <strong className="text-white/80">{date}</strong></span>
                        </div>
                        <form action={handleLink}>
                          <button
                            type="submit"
                            className="w-full py-2 bg-[#9cf4d1] text-[#0d2137] rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                          >
                            Link &amp; Import This Submission
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-white/10">
                <Link
                  href="/admin/surveys/pending"
                  className="text-xs text-[#9cf4d1] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Manage all pending imports
                </Link>
              </div>
            </div>

            {/* Quick tips */}
            <div className="bg-white rounded-xl border border-[#cccccc] p-5 space-y-3 text-sm text-[#3e4944]">
              <p className="font-semibold text-[#0d2137] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a7a5e] text-base">info</span>
                Build checklist
              </p>
              {[
                "Fill all 8 RLA scores",
                "Add ≥2 pros and ≥2 cons",
                "Complete area overview",
                "List key facilities",
                "Save → status becomes Draft",
                "Then upload photos (≥15)",
                "Approve → Publish as Live",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#1a7a5e] font-bold text-xs mt-0.5">{i + 1}.</span>
                  <span className="text-xs">{tip}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
