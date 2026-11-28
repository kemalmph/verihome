import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SurveyForm } from "./SurveyForm";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["new_lead", "draft"];

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePermissionOrRedirect(["surveys.input"]);
  const admin  = createAdminClient();

  const [{ data: property }, { data: priorSurveys }] = await Promise.all([
    admin.from("properties").select("id, name, area, status").eq("id", id).single(),
    admin
      .from("property_surveys")
      .select("id, survey_date, surveyor_name, duration_minutes")
      .eq("property_id", id)
      .order("survey_date", { ascending: false }),
  ]);

  if (!property) notFound();

  // Mirrors the check in submitSurvey — a surveyor must not reach the form for a
  // live listing, or they would fill it in and only be refused on submit.
  const closedToSurveyor =
    viewer && !viewer.permissions.includes("surveys.review") && !OPEN_STATUSES.includes(property.status ?? "");

  const prior = priorSurveys ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar activeHref={`/survey/${id}`} />
      <div data-sidebar-offset className="md:ml-(--sidebar-w) md:transition-[margin] pt-14 md:pt-0">
      <header className="bg-ink text-white">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <Link href="/survey" className="text-sm text-brand hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            All properties
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-ink">{property.name}</h1>
          <p className="text-sm text-ink-3 mt-1">
            {property.area ?? "Area not set"} · Record a site visit
          </p>
        </div>

        {closedToSurveyor ? (
          <div className="bg-white rounded-2xl border border-line shadow-card p-8 text-center">
            <span className="material-symbols-outlined text-line-strong text-4xl">lock</span>
            <p className="text-ink-2 font-medium mt-2">This listing is already published</p>
            <p className="text-sm text-ink-3 mt-1 max-w-sm mx-auto">
              Surveys can only be recorded while a property is a new lead or a draft.
              Ask an admin if this one needs revisiting.
            </p>
            <Link href="/survey" className="inline-block mt-5 text-sm font-semibold text-brand-ink hover:underline">
              Back to properties
            </Link>
          </div>
        ) : (
          <>
            {prior.length > 0 && (
              <div className="mb-6 bg-white rounded-2xl border border-line shadow-card p-5">
                <p className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-3">
                  {prior.length} previous {prior.length === 1 ? "survey" : "surveys"}
                </p>
                <ul className="space-y-2">
                  {prior.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm border-b border-canvas last:border-0 pb-2 last:pb-0">
                      <span className="text-ink-2">
                        <strong className="text-ink">{s.survey_date}</strong>
                        {s.surveyor_name ? ` · ${s.surveyor_name}` : ""}
                      </span>
                      <span className="text-xs text-ink-3">
                        {s.duration_minutes ? `${s.duration_minutes} min` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-3 mt-3">
                  Saving again records an additional visit. Previous surveys are kept.
                </p>
              </div>
            )}

            <SurveyForm
              propertyId={property.id}
              propertyName={property.name}
              defaultSurveyor={viewer?.name ?? ""}
            />
          </>
        )}
      </main>
      </div>
    </div>
  );
}
