import Link from "next/link";

/**
 * Every link here resolves.
 *
 * The previous footer pointed at /about, /terms, /privacy and /cookies —
 * none of which exist, so four of its twelve links were 404s sitting in the
 * footer of every page. /terms and /privacy now exist as real pages; /about
 * and /cookies are gone rather than left pointing at nothing.
 */
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Produk",
    links: [
      { href: "/#workspace-hunian", label: "Manajemen Workspace" },
      { href: "/#workspace-hunian", label: "Manajemen Hunian" },
      { href: "/listings", label: "Listing Marketplace" },
      { href: "/#harga", label: "Harga" },
    ],
  },
  {
    heading: "Penyewa",
    links: [
      { href: "/listings", label: "Cari Coworking & Ruang Rapat" },
      { href: "/listings", label: "Cari Kos & Hunian" },
      { href: "/#cara-kerja", label: "Cara Booking" },
    ],
  },
  {
    heading: "Perusahaan",
    links: [
      { href: "/contact", label: "Kontak Kami" },
      { href: "/list-your-property", label: "Daftarkan Properti" },
      { href: "/terms", label: "Syarat & Ketentuan" },
      { href: "/privacy", label: "Kebijakan Privasi" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-full bg-[#0d2137] text-[#e4e2e1]">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <h2 className="text-xl font-bold text-[#9cf4d1] mb-4">Cosystem</h2>
            <p className="text-sm text-[#bec9c2] leading-relaxed">
              Platform terpadu untuk mengelola operasional dan memonetisasi ruang
              kerja serta hunian dalam satu ekosistem.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
                {col.heading}
              </h5>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#bec9c2] hover:text-[#9cf4d1] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-[#bec9c2]/20">
          <p className="text-xs text-[#bec9c2]/70">
            © 2026 Cosystem. Hak cipta dilindungi undang-undang.
          </p>
        </div>
      </div>
    </footer>
  );
}
