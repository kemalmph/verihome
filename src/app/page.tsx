import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingCard } from "@/components/listings/ListingCard";
import { getFeaturedProperties } from "@/lib/supabase/queries";
import { getSavedPropertyIds } from "@/lib/supabase/save-actions";

/**
 * The marketing homepage.
 *
 * Every link to the marketplace goes to /listings, plural. The copy this was
 * written from says /listing — that route does not exist and never has, so
 * following it literally would have put a 404 behind the two busiest buttons
 * on the page.
 */

export default async function HomePage() {
  const [featuredListings, savedIds] = await Promise.all([
    getFeaturedProperties(3),
    getSavedPropertyIds(),
  ]);

  return (
    <>
      <Navbar />
      <main>
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="relative bg-[#0d2137] overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #9cf4d1 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 md:px-16 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#9cf4d1] border border-[#9cf4d1]/30 bg-[#9cf4d1]/10 rounded-full px-3 py-1.5">
                Satu Platform untuk Ruang Kerja &amp; Hunian
              </span>

              <h1 className="mt-6 text-4xl md:text-[3.25rem] md:leading-[1.1] font-bold text-white">
                Kelola Operasional dan Monetisasi Properti Anda dalam Satu Sistem.
              </h1>

              <p className="mt-6 text-lg text-white/80 max-w-2xl">
                Dari coworking space, ruang rapat, dan studio kerja hingga rumah
                tinggal, kos, dan vila. Rapikan jadwal dan tagihan penyewa,
                lalu pasarkan properti kosong Anda di Marketplace Cosystem.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="px-6 py-3.5 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
                >
                  Kontak Kami
                </Link>
                <Link
                  href="/listings"
                  className="px-6 py-3.5 rounded-lg border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors"
                >
                  Lihat Listing Tersedia
                </Link>
              </div>

              <p className="mt-5 text-sm text-white/55">
                Konsultasi kebutuhan properti &nbsp;•&nbsp; Setup dibantu tim kami
                &nbsp;•&nbsp; Terintegrasi penuh
              </p>
            </div>
          </div>
        </section>

        {/* ── Satu sistem untuk dua jenis aset ────────────────────── */}
        <section id="workspace-hunian" className="scroll-mt-20 py-20 md:py-24 max-w-7xl mx-auto px-4 md:px-16">
          <Eyebrow>Fleksibel untuk Berbagai Aset</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
            Dirancang untuk Mengelola Workspace maupun Hunian
          </h2>
          <p className="mt-4 text-[#3e4944] text-lg max-w-3xl">
            Satu dashboard terpusat yang otomatis menyesuaikan fitur dengan jenis
            properti dan skema sewa Anda—baik hitungan jam, harian, maupun bulanan.
          </p>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetCard
              icon="desk"
              title="Ruang Kerja & Workspace"
              description="Kelola coworking space, private office, meeting room, hingga studio kreatif dengan sistem reservasi dan kuota yang presisi."
              points={[
                "Kalender booking per jam atau per sesi anti-bentrok",
                "Manajemen paket membership & kredit jam penggunaan",
                "Pencatatan konsumsi dan margin per booking",
              ]}
            />
            <AssetCard
              icon="apartment"
              title="Hunian & Rumah Tinggal"
              description="Permudah operasional kos eksklusif, rumah kontrakan, apartemen, vila, hingga guesthouse tanpa pencatatan manual."
              points={[
                "Pencatatan tagihan dan verifikasi bukti transfer",
                "Pengelolaan kontrak sewa, deposit, dan data penghuni",
                "Kalender ketersediaan dan blokir tanggal oleh pemilik",
              ]}
            />
          </div>
        </section>

        {/* ── Fitur kelola & monetisasi ───────────────────────────── */}
        <section id="fitur-kelola" className="scroll-mt-20 bg-white py-20 md:py-24 border-y border-[#e4e2e1]">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <Eyebrow>Operasional &amp; Pertumbuhan</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
              Rapikan Manajemen Harian, Maksimalkan Okupansi Unit
            </h2>

            <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ValueBlock
                number="01"
                title="Satu Catatan untuk Jadwal & Tagihan Sewa"
                description="Hentikan rekap manual di spreadsheet. Jadwal, kontrak, tagihan, dan jatuh temponya tercatat di satu dashboard — dan setiap pelunasan yang dikonfirmasi langsung masuk ke pembukuan properti Anda pada transaksi yang sama."
                highlights={["0% risiko double booking", "Pembukuan tercatat saat pembayaran dikonfirmasi"]}
              />
              <ValueBlock
                id="monetisasi"
                number="02"
                title="Ubah Slot Kosong Menjadi Pendapatan"
                description="Properti yang datanya sudah lengkap bisa ditayangkan ke halaman listing publik dari dashboard yang sama. Foto, deskripsi, dan tarif terbit apa adanya tanpa input ulang, dan tanggal yang Anda blokir tidak bisa dipesan."
                highlights={["Tanpa input data dua kali", "Tanpa kelola dua aplikasi"]}
                href="/listings"
                hrefLabel="Lihat halaman listing"
              />
              <ValueBlock
                number="03"
                title="Lihat Angkanya, Bukan Tebakannya"
                description="Okupansi per unit, sewa yang sudah terikat, tagihan yang jatuh tempo, dan margin tiap booking setelah dikurangi biaya — dihitung dari transaksi yang tercatat, bukan dari rekap yang diketik ulang."
                highlights={["Laporan okupansi & arus kas", "Pembukuan berpasangan yang tidak bisa diubah diam-diam"]}
              />
            </div>
          </div>
        </section>

        {/* ── Cara kerja ──────────────────────────────────────────── */}
        <section id="cara-kerja" className="scroll-mt-20 py-20 md:py-24 max-w-7xl mx-auto px-4 md:px-16">
          <Eyebrow>Cara Kerja</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137]">
            Mulai Kelola &amp; Monetisasi dalam 3 Langkah
          </h2>

          <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                t: "Konsultasi & Daftarkan Properti Anda",
                d: "Hubungi tim kami untuk menyesuaikan konfigurasi sistem dengan jumlah unit dan jenis aset workspace maupun hunian Anda.",
              },
              {
                t: "Atur Jadwal & Tayangkan di Listing",
                d: "Kelola penyewa yang sudah ada dari satu dashboard, lalu nyalakan visibilitas listing publik untuk menjaring penyewa baru.",
              },
              {
                t: "Terima Pembayaran & Pantau Laporan",
                d: "Dana sewa masuk secara terstruktur lengkap dengan laporan okupansi, riwayat transaksi, dan performa tiap unit.",
              },
            ].map((s, i) => (
              <li key={s.t}>
                <div className="w-11 h-11 rounded-full bg-[#1a7a5e] text-white font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-lg font-bold text-[#0d2137]">{s.t}</h3>
                <p className="mt-2 text-[#3e4944] leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Etalase listing aktif ───────────────────────────────── */}
        <section className="bg-[#f0eded] py-20 md:py-24">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            <Eyebrow>Ekosistem Aktif</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
              Workspace &amp; Hunian yang Dikelola Melalui Cosystem
            </h2>
            <p className="mt-4 text-[#3e4944] text-lg max-w-3xl">
              Jelajahi hunian yang jadwalnya terhubung langsung dengan sistem
              pengelola. Unit ruang kerja menyusul tayang di marketplace.
            </p>

            {featuredListings.length > 0 ? (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredListings.map((p) => (
                  <ListingCard key={p.id} property={p} savedIds={savedIds} />
                ))}
              </div>
            ) : (
              /* An empty grid with a heading above it reads as a broken page.
                 Saying so plainly is better than three grey rectangles. */
              <p className="mt-12 text-[#6e7a74]">
                Belum ada unit yang tayang saat ini.
              </p>
            )}

            <div className="mt-10">
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 text-[#1a7a5e] font-semibold hover:underline"
              >
                Lihat Semua Listing
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Skema harga ─────────────────────────────────────────── */}
        <section id="harga" className="scroll-mt-20 py-20 md:py-24 max-w-7xl mx-auto px-4 md:px-16">
          <Eyebrow>Skema Kerja Sama</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-[#0d2137] max-w-3xl">
            Solusi Fleksibel Sesuai Skala Properti Anda
          </h2>
          <p className="mt-4 text-[#3e4944] text-lg max-w-3xl">
            Setiap properti memiliki kebutuhan operasional dan target okupansi yang
            berbeda. Konsultasikan kebutuhan Anda dengan tim kami untuk mendapatkan
            penawaran terbaik.
          </p>

          <div className="mt-12 max-w-3xl bg-white border border-[#ddd7d4] rounded-2xl p-8 md:p-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1a7a5e]">
              Paket Kemitraan Pengelola
            </p>
            <p className="mt-2 text-2xl md:text-3xl font-bold text-[#0d2137]">
              Penawaran Khusus — Kontak Kami
            </p>
            <p className="mt-4 text-[#3e4944] leading-relaxed">
              Akses penuh sistem manajemen properti terintegrasi dengan katalog
              marketplace Cosystem untuk meningkatkan efisiensi dan tingkat hunian
              unit Anda.
            </p>

            <ul className="mt-7 space-y-3">
              {[
                "Sistem manajemen ruang kerja & hunian terpadu",
                "Kalender okupansi, pencatatan tagihan, dan laporan keuangan",
                "Tayang di halaman Listing Marketplace Cosystem",
                "Pendampingan onboarding dan migrasi data awal oleh tim Cosystem",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-[#3e4944]">
                  <span className="material-symbols-outlined text-[#1a7a5e] text-xl leading-6">
                    check_circle
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/contact"
              className="mt-9 inline-block px-6 py-3.5 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
            >
              Kontak Kami untuk Penawaran
            </Link>
          </div>
        </section>

        {/* ── Banner penutup ──────────────────────────────────────── */}
        <section className="bg-[#0d2137] py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 md:px-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white max-w-3xl mx-auto">
              Siap Mengelola dan Memonetisasi Properti Anda Lebih Efisien?
            </h2>
            <p className="mt-4 text-white/75 text-lg max-w-2xl mx-auto">
              Diskusikan kebutuhan pengelolaan workspace atau hunian Anda bersama
              tim Cosystem hari ini.
            </p>
            <div className="mt-9 flex flex-wrap gap-3 justify-center">
              <Link
                href="/contact"
                className="px-6 py-3.5 rounded-lg bg-[#1a7a5e] text-white font-semibold hover:bg-[#166750] transition-colors"
              >
                Kontak Kami
              </Link>
              <Link
                href="/listings"
                className="px-6 py-3.5 rounded-lg border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Cari Ruang Kerja &amp; Hunian
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1a7a5e]">
      {children}
    </p>
  );
}

function AssetCard({
  icon, title, description, points,
}: {
  icon: string; title: string; description: string; points: string[];
}) {
  return (
    <div className="bg-white border border-[#ddd7d4] rounded-2xl p-8 h-full">
      <span className="material-symbols-outlined text-[#1a7a5e] text-3xl">{icon}</span>
      <h3 className="mt-4 text-xl font-bold text-[#0d2137]">{title}</h3>
      <p className="mt-3 text-[#3e4944] leading-relaxed">{description}</p>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-[#3e4944]">
            <span className="material-symbols-outlined text-[#1a7a5e] text-xl leading-6">
              check_circle
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValueBlock({
  id, number, title, description, highlights, href, hrefLabel,
}: {
  id?: string;
  number: string;
  title: string;
  description: string;
  highlights: string[];
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div
      id={id}
      className="bg-[#f6f3f2] border border-[#e4e2e1] rounded-2xl p-7 h-full flex flex-col scroll-mt-28"
    >
      <span className="text-sm font-bold text-[#1a7a5e]">{number}</span>
      <h3 className="mt-3 text-lg font-bold text-[#0d2137]">{title}</h3>
      <p className="mt-3 text-[#3e4944] leading-relaxed flex-1">{description}</p>
      <ul className="mt-5 space-y-1.5">
        {highlights.map((h) => (
          <li key={h} className="text-sm text-[#1a7a5e] font-medium">
            • {h}
          </li>
        ))}
      </ul>
      {href && (
        <Link href={href} className="mt-5 text-sm font-semibold text-[#1a7a5e] hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
