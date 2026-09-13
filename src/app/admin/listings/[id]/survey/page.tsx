import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { SurveyForm } from "./SurveyForm";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: property }, { data: priorSurveys }] = await Promise.all([
    admin.from("properties").select("id, name, area, status").eq("id", id).single(),
    admin
      .from("property_surveys")
      .select("id, survey_date, surveyor_name, duration_minutes")
      .eq("property_id", id)
      .order("survey_date", { ascending: false }),
  ]);

  if (!property) notFound();

  const prior = priorSurveys ?? [];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/listings" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12 max-w-[900px]">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#3e4944] mb-2">
            <Link href="/admin/listings" className="hover:text-[#1a7a5e]">Listings</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <Link href={`/admin/listings/${id}/build`} className="hover:text-[#1a7a5e]">Build Listing</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-[#1b1c1c] font-medium">Survey</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0d2137]">{property.name}</h1>
          <p className="text-sm text-[#6e7a74] mt-1">
            {property.area ?? "Area not set"} · Record a site visit
          </p>
        </div>

        {prior.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-[#cccccc] p-5">
            <p className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-3">
              {prior.length} previous {prior.length === 1 ? "survey" : "surveys"}
            </p>
            <ul className="space-y-2">
              {prior.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm border-b border-[#f6f3f2] last:border-0 pb-2 last:pb-0">
                  <span className="text-[#3e4944]">
                    <strong className="text-[#0d2137]">{s.survey_date}</strong>
                    {s.surveyor_name ? ` · ${s.surveyor_name}` : ""}
                  </span>
                  <span className="text-xs text-[#6e7a74]">
                    {s.duration_minutes ? `${s.duration_minutes} min` : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#6e7a74] mt-3">
              Saving again records an additional visit. Previous surveys and their scores are kept.
            </p>
          </div>
        )}

        <SurveyForm propertyId={property.id} propertyName={property.name} />
      </main>
    </div>
  );
}
