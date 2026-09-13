import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

// Properties still being worked up. A live listing is not open for surveying.
const OPEN_STATUSES = ["new_lead", "draft"];

export default async function SurveyIndexPage() {
  const viewer = await getViewer();
  const admin  = createAdminClient();

  const { data: properties } = await admin
    .from("properties")
    .select("id, name, area, status, created_at, property_surveys(id)")
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false });

  const rows = (properties ?? []).map((p) => ({
    ...p,
    surveyCount: (p.property_surveys as { id: string }[] | null)?.length ?? 0,
  }));

  const unsurveyed = rows.filter((r) => r.surveyCount === 0);
  const resurveyed = rows.filter((r) => r.surveyCount > 0);

  return (
    <div className="min-h-screen bg-[#f6f3f2]">
      <header className="bg-[#0d2137] text-white">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[#9cf4d1] font-bold text-lg leading-none">VeriHome</p>
            <p className="text-white/60 text-sm mt-1">Surveyor</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/80">{viewer?.email ?? ""}</p>
            {viewer?.role === "admin" && (
              <Link href="/admin" className="text-xs text-[#9cf4d1] hover:underline">
                Admin console
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#0d2137] mb-1">Properties to survey</h1>
        <p className="text-sm text-[#6e7a74] mb-7">
          Record what you observed on site. Scores and notes feed straight into the listing.
        </p>

        {rows.length === 0 && (
          <div className="bg-white rounded-xl border border-[#cccccc] p-10 text-center">
            <span className="material-symbols-outlined text-[#bec9c2] text-4xl">task_alt</span>
            <p className="text-[#3e4944] font-medium mt-2">Nothing waiting</p>
            <p className="text-sm text-[#6e7a74] mt-1">
              Every property has been surveyed. New ones appear here automatically.
            </p>
          </div>
        )}

        {unsurveyed.length > 0 && (
          <>
            <h2 className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-3">
              Not yet surveyed · {unsurveyed.length}
            </h2>
            <ul className="space-y-2 mb-8">
              {unsurveyed.map((p) => <PropertyRow key={p.id} p={p} />)}
            </ul>
          </>
        )}

        {resurveyed.length > 0 && (
          <>
            <h2 className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-3">
              Already surveyed · {resurveyed.length}
            </h2>
            <ul className="space-y-2">
              {resurveyed.map((p) => <PropertyRow key={p.id} p={p} />)}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function PropertyRow({ p }: {
  p: { id: string; name: string; area: string | null; status: string | null; surveyCount: number };
}) {
  return (
    <li>
      <Link
        href={`/survey/${p.id}`}
        className="flex items-center justify-between gap-4 bg-white rounded-xl border border-[#cccccc] px-5 py-4 hover:border-[#1a7a5e] transition-colors"
      >
        <div className="min-w-0">
          <p className="font-semibold text-[#0d2137] truncate">{p.name}</p>
          <p className="text-xs text-[#6e7a74] mt-0.5">
            {p.area ?? "Area not set"} · {p.status === "new_lead" ? "New lead" : "Draft"}
            {p.surveyCount > 0 && ` · ${p.surveyCount} previous`}
          </p>
        </div>
        <span className="material-symbols-outlined text-[#1a7a5e] flex-shrink-0">chevron_right</span>
      </Link>
    </li>
  );
}
