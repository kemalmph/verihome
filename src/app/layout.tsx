import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "VeriHome | Curated Property Rentals in Jakarta",
  description:
    "VeriHome is Jakarta's most trusted curated rental marketplace for international professionals, expats, and local talent. Verified listings with independent RLA assessments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fbf9f8] text-[#1b1c1c] font-sans">
        {children}
      </body>
    </html>
  );
}
