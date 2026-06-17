import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkPendingImport, rejectPendingImport } from "@/lib/actions/survey-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PendingSurveysPage() {
  const admin = createAdminClient();

  const [{ data: pending }, { data: properties }] = await Promise.all([
    admin
      .from("pending_survey_imports")
      .select("id, tally_submission_id, property_name_text, created_at, raw_payload")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    admin
      .from("properties")
      .select("id, name, area")
      .order("name"),
  ]);

  const propertyList = properties ?? [];
  const pendingList  = pending   ?? [];

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/surveys" />
      <main className="flex-1 ml-64 p-12 max-w-[1100px]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0d2137]">Pending Survey Imports</h1>
          <p className="text-sm text-[#6e7a74] mt-1">
            Tally submissions where the property name didn&apos;t match automatically.
            Link each submission to the correct property to complete the import.
          </p>
        </div>

        {pendingList.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#cccccc] p-12 text-center">
            <span className="material-symbols-outlined text-[#1a7a5e] text-5xl">check_circle</span>
            <p className="mt-3 text-[#3e4944]">No pending imports. All survey submissions have been processed.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pendingList.map((item) => {
              const rawFields =
                (item.raw_payload as { data?: { fields?: { label: string; value: unknown }[] } })
                  ?.data?.fields ?? [];
              const fieldMap = Object.fromEntries(
                rawFields.map((f) => [f.label, f.value])
              );

              async function handleLink(formData: FormData) {
                "use server";
                const propertyId = formData.get("property_id") as string;
                if (!propertyId) return;
                await linkPendingImport(item.id, propertyId);
              }

              async function handleReject() {
                "use server";
                await rejectPendingImport(item.id);
              }

              return (
                <div key={item.id} className="bg-white rounded-xl border border-[#cccccc] shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-[#f6f3f2] border-b border-[#bec9c2] flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#6e7a74]">Submission {item.tally_submission_id}</p>
                      <p className="text-sm font-semibold text-[#0d2137] mt-0.5">
                        Property typed: &ldquo;{item.property_name_text}&rdquo;
                      </p>
                    </div>
                    <span className="text-xs text-[#6e7a74]">
                      {new Date(item.created_at).toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b border-[#e4e2e1]">
                    {[
                      { label: "Surveyor", val: String(fieldMap["Nama Surveyor"] ?? fieldMap["Surveyor"] ?? "—") },
                      { label: "PIC",      val: String(fieldMap["Nama PIC"]      ?? fieldMap["PIC"]      ?? "—") },
                      { label: "Date",     val: String(fieldMap["Tanggal"]       ?? fieldMap["Date"]     ?? "—") },
                      { label: "Duration", val: fieldMap["Durasi (menit)"] ? `${fieldMap["Durasi (menit)"]} min` : "—" },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-xs text-[#6e7a74] mb-0.5">{label}</p>
                        <p className="font-medium text-[#1b1c1c]">{val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="px-6 py-5 flex flex-col md:flex-row gap-4 items-start md:items-end">
                    <form action={handleLink} className="flex gap-3 flex-1 items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1">
                          Link to property
                        </label>
                        <select
                          name="property_id"
                          required
                          className="w-full h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
                        >
                          <option value="">Search and select…</option>
                          {propertyList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.area})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="h-11 px-5 bg-[#1a7a5e] text-white rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap"
                      >
                        Link &amp; Import
                      </button>
                    </form>

                    <form action={handleReject}>
                      <button
                        type="submit"
                        onClick={(e) => { if (!confirm("Reject this submission?")) e.preventDefault(); }}
                        className="h-11 px-4 border border-red-200 text-red-600 bg-red-50 rounded-lg text-sm hover:bg-red-100 whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </form>

                    <Link
                      href={`/admin/surveys/pending/${item.id}`}
                      className="h-11 px-4 border border-[#cccccc] text-[#3e4944] rounded-lg text-sm hover:bg-[#f6f3f2] flex items-center whitespace-nowrap"
                    >
                      View raw →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
