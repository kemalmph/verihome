import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Cosystem | Curated Property Rentals in Jakarta",
  description:
    "Cosystem is Jakarta's most trusted curated rental marketplace for international professionals, expats, and local talent. Verified listings with independent RLA assessments.",
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

  return (
    <html lang={locale} className={`${publicSans.variable} h-full antialiased`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; vertical-align: middle; }`}</style>
      </head>
      <body className="min-h-full flex flex-col bg-[#fbf9f8] text-[#1b1c1c] font-sans">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
