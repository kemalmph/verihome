import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Kontak Kami — Cosystem",
  description:
    "Diskusikan kebutuhan pengelolaan ruang kerja atau hunian Anda bersama tim Cosystem.",
};

/**
 * The route every CTA on the homepage points at.
 *
 * No invented contact details. The email comes from TEAM_EMAIL, and the
 * WhatsApp button renders only when NEXT_PUBLIC_WHATSAPP holds a number —
 * a button that opens a chat with nobody is worse than no button, because
 * the visitor blames themselves and leaves.
 */
export default function ContactPage() {
  const email = process.env.TEAM_EMAIL ?? null;

  // Digits only: wa.me rejects spaces, dashes and a leading +.
  const waRaw = process.env.NEXT_PUBLIC_WHATSAPP ?? "";
  const wa = waRaw.replace(/[^\d]/g, "") || null;

  return (
    <>
      <Navbar />
      <main className="bg-[#f6f3f2] min-h-[70vh]">
        <div className="max-w-5xl mx-auto px-4 md:px-16 py-16 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1a7a5e]">
            Kontak Kami
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-2xl">
            Diskusikan Kebutuhan Properti Anda
          </h1>
          <p className="mt-4 text-[#3e4944] text-lg max-w-2xl">
            Ceritakan jenis aset dan jumlah unit Anda — ruang kerja, kos, rumah
            kontrakan, atau kombinasinya. Tim kami menyesuaikan konfigurasi
            sistemnya, termasuk membantu memindahkan data yang sudah ada.
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#ddd7d4] rounded-2xl p-8">
              <span className="material-symbols-outlined text-[#1a7a5e] text-3xl">
                apartment
              </span>
              <h2 className="mt-4 text-xl font-bold text-[#0d2137]">
                Daftarkan Properti Anda
              </h2>
              <p className="mt-3 text-[#3e4944] leading-relaxed">
                Isi detail properti Anda dan tim kami menghubungi balik untuk
                membahas konfigurasi serta langkah onboarding.
              </p>
              <Link
                href="/list-your-property"
                className="mt-6 inline-block px-5 py-3 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
              >
                Mulai Pendaftaran
              </Link>
            </div>

            <div className="bg-white border border-[#ddd7d4] rounded-2xl p-8">
              <span className="material-symbols-outlined text-[#1a7a5e] text-3xl">
                support_agent
              </span>
              <h2 className="mt-4 text-xl font-bold text-[#0d2137]">
                Bicara Langsung
              </h2>
              <p className="mt-3 text-[#3e4944] leading-relaxed">
                Punya pertanyaan sebelum mendaftar? Hubungi kami langsung.
              </p>

              <div className="mt-6 space-y-3">
                {wa && (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-[#1a7a5e] font-semibold hover:underline"
                  >
                    <span className="material-symbols-outlined">chat</span>
                    WhatsApp
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-[#1a7a5e] font-semibold hover:underline"
                  >
                    <span className="material-symbols-outlined">mail</span>
                    {email}
                  </a>
                )}
                {!wa && !email && (
                  <p className="text-sm text-[#6e7a74]">
                    Silakan gunakan formulir pendaftaran properti di samping —
                    tim kami akan menghubungi Anda balik.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12 bg-white border border-[#ddd7d4] rounded-2xl p-8">
            <h2 className="text-lg font-bold text-[#0d2137]">
              Mencari ruang kerja atau hunian untuk disewa?
            </h2>
            <p className="mt-2 text-[#3e4944]">
              Halaman ini untuk pemilik dan pengelola properti. Kalau Anda sedang
              mencari tempat, jelajahi unit yang tersedia.
            </p>
            <Link
              href="/listings"
              className="mt-5 inline-flex items-center gap-2 text-[#1a7a5e] font-semibold hover:underline"
            >
              Lihat Listing Tersedia <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
