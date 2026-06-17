import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { PIPELINE_STAGES, statusColor, statusLabel } from "@/lib/pipeline";
import { StatusSelect } from "./StatusSelect";

async function createNewProperty() {
  "use server";
  const admin = createAdminClient();
  const slug = `new-property-${Date.now().toString(36)}`;
  const { data, error } = await admin
    .from("properties")
    .insert({ name: "New Property", slug, status: "new_lead", submission_type: "internal" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create property");
  redirect(`/admin/listings/${data.id}/build`);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

interface AdminListingsPageProps {
  searchParams: Promise<{ status?: string }>;
}

// Pipeline stages shown as filter tabs (in SOP order, with separator before terminal states)
const FILTER_TABS = [
  { value: "all", label: "All" },
  ...PIPELINE_STAGES,
];

export default async function AdminListingsPage({ searchParams }: AdminListingsPageProps) {
  const { status } = await searchParams;
  const admin = createAdminClient();

  // Counts per stage for the pipeline summary
  const { data: allProperties } = await admin
    .from("properties")
    .select("id, name, slug, area, property_type, price_monthly, status, created_at")
    .order("created_at", { ascending: false });

  const all = allProperties ?? [];

  // Count per status
  const counts: Record<string, number> = {};
  for (const p of all) counts[p.status] = (counts[p.status] ?? 0) + 1;

  // Active pipeline (not closed/archived)
  const activeStages = ["new_lead", "owner_approved", "survey_scheduled", "survey_completed", "draft", "approved"];
  const activePipeline = PIPELINE_STAGES.filter((s) => activeStages.includes(s.value));

  // Filtered table rows
  const filtered = status && status !== "all" ? all.filter((p) => p.status === status) : all;

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/listings" />
      <main className="flex-1 ml-64 p-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2137]">Listings Pipeline</h1>
            <p className="text-[#3e4944] mt-1">{all.length} total · {counts["live"] ?? 0} live</p>
          </div>
          <form action={createNewProperty}>
            <button
              type="submit"
              className="bg-[#1a7a5e] text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              New Property
            </button>
          </form>
        </div>

        {/* Pipeline stage summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {activePipeline.map((stage, i) => (
            <Link
              key={stage.value}
              href={`/admin/listings?status=${stage.value}`}
              className={`bg-white rounded-xl border p-4 text-center hover:border-[#1a7a5e] transition-colors ${
                status === stage.value ? "border-[#1a7a5e] ring-1 ring-[#1a7a5e]" : "border-[#cccccc]"
              }`}
            >
              <div className="text-2xl font-bold text-[#0d2137]">{counts[stage.value] ?? 0}</div>
              <div className="text-xs text-[#6e7a74] mt-0.5 leading-tight">{stage.label}</div>
              {i < activePipeline.length - 1 && (
                <div className="text-[#bec9c2] text-xs mt-1">↓</div>
              )}
            </Link>
          ))}
        </div>

        {/* Live + terminal stage quick stats */}
        <div className="flex gap-3 mb-8">
          {[
            { value: "live",     label: "Live on site" },
            { value: "closed",   label: "Closed leads" },
            { value: "archived", label: "Archived" },
          ].map((s) => (
            <Link
              key={s.value}
              href={`/admin/listings?status=${s.value}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                status === s.value
                  ? "border-[#1a7a5e] bg-white text-[#1a7a5e] font-semibold"
                  : "border-[#cccccc] bg-white text-[#3e4944] hover:border-[#1a7a5e]"
              }`}
            >
              <StatusBadge status={s.value} />
              <span className="font-bold">{counts[s.value] ?? 0}</span>
              <span className="text-[#6e7a74]">{s.label}</span>
            </Link>
          ))}
          <Link
            href="/admin/listings"
            className={`ml-auto px-4 py-2 rounded-lg border text-sm transition-colors ${
              !status || status === "all"
                ? "border-[#1a7a5e] bg-white text-[#1a7a5e] font-semibold"
                : "border-[#cccccc] bg-white text-[#3e4944] hover:border-[#1a7a5e]"
            }`}
          >
            View all
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f3f2] border-b border-[#bec9c2]">
                {["Property", "Area", "Price", "Stage", "Added", "Actions"].map((h) => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-bold text-[#3e4944] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec9c2]">
              {filtered.map((p) => {
                const price = p.price_monthly
                  ? `IDR ${new Intl.NumberFormat("id-ID").format(p.price_monthly)}`
                  : "—";
                const added = new Date(p.created_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <tr key={p.id} className="hover:bg-[#f6f3f2] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0d2137] text-sm">{p.name}</p>
                      <p className="text-xs text-[#3e4944] capitalize">{p.property_type ?? "—"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#1b1c1c]">{p.area ?? "—"}</td>
                    <td className="px-6 py-4 text-sm font-medium text-[#1a7a5e]">{price}</td>
                    <td className="px-6 py-4">
                      <StatusSelect propertyId={p.id} currentStatus={p.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6e7a74]">{added}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.status === "live" && (
                          <Link href={`/listings/${p.slug}`} target="_blank" className="text-[#6e7a74] hover:text-[#1a7a5e] text-xs">
                            View
                          </Link>
                        )}
                        {!["live", "archived", "closed"].includes(p.status) && (
                          <Link href={`/admin/listings/${p.id}/build`} className="text-[#3b82f6] text-sm font-medium hover:underline">
                            Build
                          </Link>
                        )}
                        <Link href={`/admin/listings/${p.id}`} className="text-[#1a7a5e] text-sm font-medium hover:underline">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#6e7a74]">
                    No listings in this stage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
