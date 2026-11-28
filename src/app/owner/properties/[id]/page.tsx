import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireOwner, NotFoundError } from "@/lib/auth/guards";
import { ownerPropertyDetail } from "@/lib/owner/queries";
import { t } from "@/lib/i18n/strings";
import { ProposeRate } from "./ProposeRate";

export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

const CHECKLIST_LABELS: [key: string, label: string][] = [
  ["min_photos_uploaded",    "Foto properti belum cukup"],
  ["video_walkthrough_done", "Video keliling unit belum ada"],
  ["rla_completed",          "Penilaian Cosystem belum lengkap"],
  ["pros_cons_written",      "Catatan kelebihan dan kekurangan belum ditulis"],
  ["price_verified",         "Harga belum diverifikasi tim"],
  ["owner_contact_active",   "Kontak Anda belum dikonfirmasi"],
  ["area_overview_filled",   "Data lingkungan sekitar belum diisi"],
  ["rental_mode_configured", "Jenis sewa belum diatur"],
];

const SCORES: [key: string, label: string][] = [
  ["building_condition", "Kondisi bangunan"],
  ["natural_lighting",   "Pencahayaan alami"],
  ["ventilation",        "Sirkulasi udara"],
  ["noise_level",        "Tingkat kebisingan"],
  ["cleanliness",        "Kebersihan"],
  ["security_level",     "Keamanan"],
  ["bathroom_condition", "Kondisi kamar mandi"],
  ["furniture_quality",  "Kualitas perabot"],
];

export default async function OwnerPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let owner;
  try { owner = await requireOwner(); } catch { redirect("/owner/no-access"); }

  let detail;
  try {
    detail = await ownerPropertyDetail(id);
  } catch (e) {
    // Someone else's property is reported as not-found, never as forbidden.
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const { property, rate, rla, area, media, details, checklist } = detail;
  const isLive = property.status === "live";

  const unmet = checklist
    ? CHECKLIST_LABELS.filter(([k]) => (checklist as Record<string, unknown>)[k] !== true).map(([, l]) => l)
    : CHECKLIST_LABELS.map(([, l]) => l);

  // Worked example: what the owner actually receives for one night.
  const perNight = Number(rate?.price_per_night ?? 0);
  const pct = property.platform_commission_pct == null ? null : Number(property.platform_commission_pct);
  const margin = pct == null ? 0 : Math.round((perNight * pct) / 100);
  const cleaningToOwner = property.cleaning_fee_goes_to === "owner";

  const photos = [
    ...((media?.photos_exterior as string[]) ?? []),
    ...((media?.photos_unit as string[]) ?? []),
    ...((media?.photos_common_area as string[]) ?? []),
    ...((media?.photos_bathroom as string[]) ?? []),
  ];

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar activeHref="/owner/properties" />
      <main className="flex-1 ml-0 md:ml-(--sidebar-w) md:transition-[margin] p-6 md:p-10 pt-20 md:pt-10 max-w-4xl">
        <Link href="/owner/properties" className="text-sm text-brand-ink hover:underline">← {t("owner.nav.properties")}</Link>

        <header className="mt-3 mb-8">
          <h1 className="text-3xl font-bold text-ink">{property.name}</h1>
          <p className="text-ink-2 mt-1">{property.area}</p>
        </header>

        {/* Status */}
        <section className="mb-8 bg-white rounded-2xl border border-line shadow-card p-5">
          <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
            {t("owner.property.status")}
          </h2>
          {isLive ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success-soft text-success-ink">
                Tayang
              </span>
              {property.slug && (
                <Link href={`/listings/${property.slug}`} className="text-sm text-brand-ink font-medium hover:underline">
                  {t("owner.property.viewPublic")} →
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="font-semibold text-amber-900">{t("owner.property.notLive")}</p>
              <p className="text-sm text-ink-2 mt-1">{t("owner.property.missingItems")}:</p>
              <ul className="mt-2 space-y-1">
                {unmet.map((u) => (
                  <li key={u} className="text-sm text-ink-2 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-base shrink-0">radio_button_unchecked</span>
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
              {unmet.length === 0 && (
                <p className="text-sm text-brand-ink mt-2">
                  Semua sudah lengkap — tim Cosystem akan menayangkan listing ini.
                </p>
              )}
            </>
          )}
        </section>

        {/* Rates and split */}
        <section className="mb-8 bg-white rounded-2xl border border-line shadow-card p-5">
          <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
            {t("owner.property.rates")}
          </h2>

          {perNight > 0 ? (
            <>
              <div className="border border-line rounded-lg overflow-hidden text-sm mb-4">
                <div className="bg-canvas px-4 py-2 text-xs font-semibold text-ink-2 uppercase tracking-wider">
                  {t("owner.property.perNight")}
                </div>
                <div className="divide-y divide-[#f0eeed]">
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-ink-2">Tamu membayar (sewa)</span>
                    <span className="tabular-nums">{rp(perNight)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-ink-2">
                      Komisi Cosystem{pct != null ? ` (${pct}%)` : ""}
                    </span>
                    <span className="tabular-nums">− {rp(margin)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between bg-brand-soft">
                    <span className="font-semibold text-success-ink">{t("owner.property.youReceive")}</span>
                    <span className="font-bold text-success-ink tabular-nums">{rp(perNight - margin)}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-ink-3">
                Biaya kebersihan {rp(Number(rate?.cleaning_fee ?? 0))} —{" "}
                {cleaningToOwner ? "menjadi hak Anda" : "menjadi hak Cosystem"}.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-2">Tarif harian belum diatur untuk properti ini.</p>
          )}

          <div className="mt-5 pt-4 border-t border-line">
            <ProposeRate propertyId={property.id} current={rate as Record<string, unknown> | null} />
          </div>
        </section>

        {/* Assessment — read only */}
        <section className="mb-8 bg-white rounded-2xl border border-line shadow-card p-5">
          <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1">
            {t("owner.property.assessment")}
          </h2>
          <p className="text-xs text-ink-3 mb-4 max-w-2xl">{t("owner.property.assessmentNote")}</p>

          {rla ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {SCORES.map(([k, label]) => {
                  const v = (rla as Record<string, unknown>)[k];
                  return (
                    <div key={k} className="bg-canvas rounded-lg p-3">
                      <p className="text-[11px] text-ink-3 leading-tight">{label}</p>
                      <p className="text-lg font-bold text-ink tabular-nums">
                        {v == null ? "—" : `${v}/10`}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-success-ink mb-1">{t("owner.property.pros")}</p>
                  <ul className="text-sm text-ink-2 space-y-0.5">
                    {((rla.pros as string[]) ?? []).map((p, i) => <li key={i}>· {p}</li>)}
                    {(((rla.pros as string[]) ?? []).length === 0) && <li className="text-ink-3">—</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#8c3a2c] mb-1">{t("owner.property.cons")}</p>
                  <ul className="text-sm text-ink-2 space-y-0.5">
                    {((rla.cons as string[]) ?? []).map((c, i) => <li key={i}>· {c}</li>)}
                    {(((rla.cons as string[]) ?? []).length === 0) && <li className="text-ink-3">—</li>}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-2">Penilaian belum dilakukan.</p>
          )}
        </section>

        {/* Media — read only */}
        <section className="mb-8 bg-white rounded-2xl border border-line shadow-card p-5">
          <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
            {t("owner.property.media")}
          </h2>
          {photos.length === 0 ? (
            <p className="text-sm text-ink-2">Belum ada foto.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {photos.slice(0, 8).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-full aspect-[4/3] object-cover rounded-lg" />
              ))}
            </div>
          )}
          {media?.video_url ? (
            <a href={media.video_url as string} target="_blank" rel="noopener noreferrer"
               className="inline-block mt-3 text-sm text-brand-ink font-medium hover:underline">
              Lihat video keliling →
            </a>
          ) : null}
        </section>

        {/* Area + rules */}
        {(area || details) && (
          <section className="mb-8 bg-white rounded-2xl border border-line shadow-card p-5">
            <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">Lingkungan & fasilitas</h2>
            {area && (
              <p className="text-sm text-ink-2 mb-3">
                {[area.nearest_mrt && `MRT ${area.nearest_mrt} (${area.mrt_distance ?? "—"})`,
                  area.nearest_minimarket && `Minimarket ${area.nearest_minimarket}`,
                  area.nearest_clinic && `Klinik ${area.nearest_clinic}`]
                  .filter(Boolean).join(" · ")}
              </p>
            )}
            {details?.facilities && (
              <p className="text-sm text-ink-2">
                {((details.facilities as string[]) ?? []).join(" · ")}
              </p>
            )}
          </section>
        )}

        <Link
          href={`/owner/properties/${property.id}/calendar`}
          className="inline-block px-5 py-3 bg-brand text-white rounded-lg font-semibold text-sm hover:opacity-90"
        >
          {t("owner.calendar.title")} →
        </Link>
      </main>
    </div>
  );
}
