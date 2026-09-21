import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { requireAdmin } from "@/lib/auth/guards";
import { listCronRuns } from "@/lib/actions/cron-actions";
import { RunNowButton } from "./RunNowButton";

export const dynamic = "force-dynamic";

const STEP_LABEL: Record<string, string> = {
  "expire-bookings":   "Lepas tanggal pemesanan kedaluwarsa",
  "complete-bookings": "Akui pendapatan menginap selesai",
  "send-reminders":    "Pengingat check-in dan pembayaran",
  "expire-credits":    "Kredit kedaluwarsa",
};

function wib(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
  });
}

export default async function AdminCronPage() {
  await requireAdmin();
  const runs = await listCronRuns();

  // Group by run: every step of one dispatch shares a start minute.
  const groups = new Map<string, typeof runs>();
  for (const r of runs) {
    const key = r.started_at.slice(0, 16);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="flex min-h-screen bg-[#f6f3f2]">
      <AdminSidebar activeHref="/admin/cron" />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-12 pt-20 md:pt-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0d2137]">Tugas harian</h1>
          <p className="text-[#3e4944] mt-1 max-w-2xl">
            Satu jadwal, <code className="text-sm">0 0 * * *</code> UTC —{" "}
            <strong>07:00 WIB</strong>. Setiap langkah mencatat berapa baris yang
            layak diproses, berapa berhasil, dan berapa gagal.
          </p>
        </header>

        <div className="mb-8 bg-white rounded-xl border border-[#cccccc] shadow-sm p-5">
          <RunNowButton />
          <p className="text-xs text-[#6e7a74] mt-2">
            Menjalankan langkah yang sama dengan penjadwal, tanpa menunggu sehari.
          </p>
        </div>

        {groups.size === 0 ? (
          <div className="bg-white rounded-xl border border-[#cccccc] p-10 text-center">
            <p className="text-[#3e4944]">Belum ada catatan. Jalankan sekali untuk mengisinya.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([key, steps]) => {
              const anyFailed = steps.some((s) => s.failed > 0);
              return (
                <section
                  key={key}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                    anyFailed ? "border-[#cf2f52]" : "border-[#cccccc]"
                  }`}
                >
                  <div className={`px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${
                    anyFailed ? "bg-[#fbeeec] border-[#e2b3ab]" : "border-[#e4e2e1]"
                  }`}>
                    <p className="font-semibold text-sm text-[#0d2137]">{wib(steps[0].started_at)}</p>
                    {anyFailed ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#cf2f52] text-white">
                        ada kegagalan
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e8f5f0] text-[#12614a]">
                        bersih
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: 560 }}>
                      <thead>
                        <tr className="text-xs uppercase tracking-wider text-[#6e7a74] border-b border-[#e4e2e1]">
                          <th className="text-left px-5 py-2 font-medium">Langkah</th>
                          <th className="text-right px-3 py-2 font-medium">Layak</th>
                          <th className="text-right px-3 py-2 font-medium">Berhasil</th>
                          <th className="text-right px-3 py-2 font-medium">Gagal</th>
                          <th className="text-left px-5 py-2 font-medium">Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {steps.map((s) => {
                          const payload = s.errors as
                            { errors?: { id: string; error: string }[]; notes?: Record<string, unknown> } | unknown[];
                          const errs = Array.isArray(payload) ? [] : (payload?.errors ?? []);
                          const notes = Array.isArray(payload) ? null : (payload?.notes ?? null);
                          return (
                            <tr key={s.id} className="border-b border-[#f0eeed] last:border-0 align-top">
                              <td className="px-5 py-2.5 text-[#0d2137]">
                                {STEP_LABEL[s.step] ?? s.step}
                                <span className="block text-xs text-[#6e7a74]">{s.step}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{s.candidates}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-[#1a7a5e] font-semibold">
                                {s.succeeded}
                              </td>
                              <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                                s.failed > 0 ? "text-[#cf2f52]" : "text-[#6e7a74]"
                              }`}>
                                {s.failed}
                              </td>
                              <td className="px-5 py-2.5 text-xs text-[#3e4944]">
                                {errs.length > 0 && (
                                  <ul className="space-y-0.5 mb-1">
                                    {errs.slice(0, 4).map((e, i) => (
                                      <li key={i} className="text-[#8c3a2c]">
                                        <strong>{e.id}</strong> — {e.error}
                                      </li>
                                    ))}
                                    {errs.length > 4 && <li>dan {errs.length - 4} lainnya</li>}
                                  </ul>
                                )}
                                {notes && (
                                  <code className="text-[11px] text-[#6e7a74] break-all">
                                    {JSON.stringify(notes)}
                                  </code>
                                )}
                                {errs.length === 0 && !notes && s.candidates === 0 && (
                                  <span className="text-[#6e7a74]">tidak ada yang perlu diproses</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
