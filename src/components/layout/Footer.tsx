import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-[#0d2137] text-[#e4e2e1]">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <h2 className="text-xl font-bold text-[#9cf4d1] mb-4">VeriHome</h2>
            <p className="text-sm text-[#bec9c2] leading-relaxed">
              Bridging the trust gap in the Jakarta rental market with
              independent verification and professional guidance.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
              Platform
            </h5>
            <ul className="space-y-3">
              {[
                { href: "/listings", label: "Listings" },
                { href: "/#how-it-works", label: "How it Works" },
                { href: "/#neighborhoods", label: "Neighborhoods" },
                { href: "/list-your-property", label: "List Your Property" },
              ].map((link) => (
                <li key={link.href}>
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

          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
              Company
            </h5>
            <ul className="space-y-3">
              {[
                { href: "/about", label: "About Us" },
                { href: "/contact", label: "Contact Support" },
                { href: "/terms", label: "Terms of Service" },
                { href: "/privacy", label: "Privacy Policy" },
              ].map((link) => (
                <li key={link.href}>
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

          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
              Areas
            </h5>
            <ul className="space-y-3">
              {["Kemang", "SCBD", "Senayan", "Sudirman", "Menteng"].map(
                (area) => (
                  <li key={area}>
                    <Link
                      href={`/listings?area=${area.toLowerCase()}`}
                      className="text-sm text-[#bec9c2] hover:text-[#9cf4d1] transition-colors"
                    >
                      {area}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#bec9c2]/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[#bec9c2]/70">
            © 2024 VeriHome Jakarta. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-[#bec9c2]/70">
            <Link href="/privacy" className="hover:text-[#9cf4d1] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#9cf4d1] transition-colors">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-[#9cf4d1] transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
