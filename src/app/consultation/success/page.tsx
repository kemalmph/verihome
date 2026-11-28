import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/strings";

export default async function ConsultationSuccessPage() {
  const lang = await getLocale();

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-brand-soft rounded-full flex items-center justify-center mx-auto mb-6">
          <span
            className="material-symbols-outlined text-brand-ink text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        </div>

        <h1 className="text-3xl font-bold text-ink mb-3">{t("consultOk.title", lang)}</h1>
        <p className="text-lg text-ink-2 mb-2">
          {t("consultOk.lead", lang)}
        </p>
        <p className="text-ink-3 mb-10">
          {t("consultOk.body", lang)}
        </p>

        <div className="bg-[#f6f3f2] rounded-xl border border-line-strong p-6 mb-8 text-left space-y-3">
          {[
            { icon: "calendar_today", text: t("consultOk.i1", lang) },
            { icon: "videocam", text: t("consultOk.i2", lang) },
            { icon: "description", text: t("consultOk.i3", lang) },
          ].map((item) => (
            <div key={item.icon} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-brand-ink">{item.icon}</span>
              <span className="text-sm text-ink-2">{item.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/appointments"
            className="px-6 py-3 bg-brand text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {t("consultOk.viewAppt", lang)}
          </Link>
          <Link
            href="/listings"
            className="px-6 py-3 border border-ink text-ink rounded-lg font-semibold hover:bg-[#f6f3f2] transition-colors"
          >
            {t("consultOk.browseMore", lang)}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
