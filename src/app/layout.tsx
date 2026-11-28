import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar/config";

// Inter, per the V7 prototype. Variable font, so every weight from the
// 400 body to the 850 hero headline comes from one file.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cosystem — Run Your Space.",
  description:
    "The all-in-one platform to manage your workspace, members, bookings, facilities, and business.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // lang was hardcoded "en" while every marketing page was Indonesian, which
  // told screen readers and browser translation the wrong thing on every
  // page. It now matches what is actually rendered.
  const locale = await getLocale();

  // On <html> so the server's first paint already has the sidebar at the
  // chosen width — and so the page margin, which lives in 30-odd page files
  // rather than in the sidebar, follows from one CSS variable.
  const sidebarCollapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;

  return (
    <html
      lang={locale}
      data-sidebar={sidebarCollapsed ? SIDEBAR_COLLAPSED : undefined}
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; vertical-align: middle; }`}</style>
      </head>
      <body className="min-h-full flex flex-col bg-background text-ink font-sans">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
