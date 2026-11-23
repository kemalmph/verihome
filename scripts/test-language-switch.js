#!/usr/bin/env node
/**
 * The EN/ID switch must actually switch the language.
 *
 * Before this, the control was `useState("EN")` and nothing else: it defaulted
 * to English, every marketing page was Indonesian, every booking page was
 * English, and clicking either side changed only which label was bold. A
 * switch that moves but changes nothing is not a smaller feature than a
 * working one — it is a false statement about the product, at the top of
 * every page.
 *
 * So this checks three separate things, because each can break alone:
 *
 *   1. Both languages render, on every public page, without a 500.
 *   2. The chosen language is the one on screen — asserted with a phrase that
 *      must appear and the other language's phrase that must not. A page
 *      half-translated still passes a "did it change?" test; it does not pass
 *      this one.
 *   3. The choice survives clicking the control and then navigating. A cookie
 *      written without `path` works on the page that set it and nowhere else.
 *
 * Listing names, descriptions and area names come from single Indonesian
 * columns in the database and do not translate. The assertions below are all
 * on interface text for that reason.
 *
 *   npm run build && npm run start
 *   node scripts/test-language-switch.js
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const COOKIE = "cosystem_locale";

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

// Each page, with a phrase that proves the locale took. `absent` is the other
// language's wording for the same spot: present together, they catch a page
// that renders a mix.
const PAGES = [
  {
    path: "/",
    id: { present: "Kelola Operasional", absent: "Run and Monetise" },
    en: { present: "Run and Monetise", absent: "Kelola Operasional" },
  },
  {
    path: "/listings",
    id: { present: "Hanya properti terkurasi", absent: "Only verified, curated" },
    en: { present: "Only verified, curated", absent: "Hanya properti terkurasi" },
  },
  {
    path: "/contact",
    id: { present: "Diskusikan Kebutuhan Properti", absent: "Let&#x27;s Talk About Your Property" },
    en: { present: "Talk About Your Property", absent: "Diskusikan Kebutuhan Properti" },
  },
  {
    path: "/terms",
    id: { present: "Dokumen ini sedang disiapkan", absent: "This document is being prepared" },
    en: { present: "This document is being prepared", absent: "Dokumen ini sedang disiapkan" },
  },
  {
    path: "/privacy",
    id: { present: "Kebijakan Privasi", absent: "This document is being prepared" },
    en: { present: "Privacy Policy", absent: "Dokumen ini sedang disiapkan" },
  },
  {
    path: "/consultation",
    id: { present: "Pilih paket konsultasi", absent: "Choose your consultation package" },
    en: { present: "Choose your consultation package", absent: "Pilih paket konsultasi" },
  },
  {
    path: "/list-your-property",
    id: { present: "Daftarkan properti Anda", absent: "Join our curated marketplace" },
    en: { present: "List your property", absent: "Bergabunglah dengan marketplace" },
  },
  {
    path: "/auth/login",
    id: { present: "Selamat datang di Cosystem", absent: "Welcome to Cosystem" },
    en: { present: "Welcome to Cosystem", absent: "Selamat datang di Cosystem" },
  },
];

// The navbar and footer are on all fifteen public pages, so a miss here is a
// miss everywhere. Checked separately from the page bodies for that reason.
const CHROME = {
  id: ["Jelajahi Listing", "Kontak Kami", "Perusahaan", "Penyewa"],
  en: ["Browse Listings", "Contact Us", "Company", "Renters"],
};

(async () => {
  const browser = await chromium.launch();

  // ── 1 & 2: every page, in each language ──────────────────────────────────
  for (const locale of ["id", "en"]) {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      { name: COOKIE, value: locale, url: BASE },
    ]);
    const page = await ctx.newPage();

    for (const spec of PAGES) {
      const res = await page.goto(`${BASE}${spec.path}`, { waitUntil: "domcontentloaded" });
      check(res?.status() === 200, `${locale} ${spec.path} → ${res?.status()}`);

      const html = await page.content();
      const want = spec[locale];
      check(
        html.includes(want.present),
        `${locale} ${spec.path}: memuat "${want.present}"`,
      );
      check(
        !html.includes(want.absent),
        `${locale} ${spec.path}: TIDAK memuat teks bahasa lain "${want.absent}"`,
      );

      // <html lang> drives screen readers and browser translation. It was
      // hardcoded "en" on Indonesian pages for the life of the site.
      const htmlLang = await page.locator("html").getAttribute("lang");
      check(htmlLang === locale, `${locale} ${spec.path}: <html lang="${htmlLang}">`);
    }

    // Chrome, checked once per locale on a page that has all of it.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const home = await page.content();
    for (const phrase of CHROME[locale]) {
      check(home.includes(phrase), `${locale} nav/footer: "${phrase}"`);
    }
    for (const phrase of CHROME[locale === "id" ? "en" : "id"]) {
      check(!home.includes(phrase), `${locale} nav/footer bebas dari "${phrase}"`);
    }

    await ctx.close();
  }

  // ── 3: the control itself, and whether the choice travels ────────────────
  {
    // Stated explicitly: Playwright's default Accept-Language varies by
    // build, and a test whose expected result depends on that is a test that
    // fails for the wrong reason.
    const ctx = await browser.newContext({ locale: "en-US" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

    // No cookie yet: Accept-Language decides. Playwright's default is en-US,
    // so this also covers the browser-language guess.
    const firstLang = await page.locator("html").getAttribute("lang");
    check(
      firstLang === "en",
      `tanpa cookie, Accept-Language en-US → lang="${firstLang}"`,
    );

    const idButton = page.locator('button[lang="id"]');
    check(await idButton.count() === 1, "tombol ID ada di nav");
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      idButton.click(),
    ]);
    await page.waitForFunction(
      () => document.documentElement.lang === "id",
      null,
      { timeout: 15000 },
    ).catch(() => {});
    check(
      (await page.locator("html").getAttribute("lang")) === "id",
      "klik ID mengubah halaman ke bahasa Indonesia",
    );
    check(
      (await page.content()).includes("Kelola Operasional"),
      "isi halaman ikut berganti, bukan hanya atribut lang",
    );

    const cookie = (await ctx.cookies()).find((c) => c.name === COOKIE);
    check(cookie?.value === "id", `cookie tersimpan: ${cookie?.value}`);
    check(cookie?.path === "/", `cookie berlaku di seluruh situs (path=${cookie?.path})`);

    // A cookie without a path works on the page that set it and nowhere else,
    // which looks exactly like "the switch works" until you click a link.
    await page.goto(`${BASE}/listings`, { waitUntil: "domcontentloaded" });
    check(
      (await page.locator("html").getAttribute("lang")) === "id",
      "pilihan bahasa bertahan setelah pindah halaman",
    );
    check(
      (await page.content()).includes("Hanya properti terkurasi"),
      "halaman berikutnya juga berbahasa Indonesia",
    );

    await ctx.close();
  }

  // ── 4: the switch before JavaScript ──────────────────────────────────────
  //
  // Disabling JavaScript reproduces the pre-hydration window deterministically.
  // With onClick handlers this step fails every time; as a form it passes,
  // which is the whole point of it being a form. Found because the same click
  // that works locally lost the race against hydration on production.
  {
    const ctx = await browser.newContext({ locale: "en-US", javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    check(
      (await page.locator("html").getAttribute("lang")) === "en",
      "tanpa JS: halaman terbuka dalam bahasa Inggris",
    );

    await page.locator('button[lang="id"]').click().catch(() => {});
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    check(
      (await page.locator("html").getAttribute("lang")) === "id",
      "tanpa JS: klik ID tetap mengganti bahasa",
    );
    check(
      (await page.content()).includes("Kelola Operasional"),
      "tanpa JS: isi halaman ikut berganti",
    );
    await ctx.close();
  }

  await browser.close();

  console.log(`\nPASS ${pass.length}`);
  for (const p of pass) console.log(`  ok   ${p}`);
  if (fail.length) {
    console.log(`\nFAIL ${fail.length}`);
    for (const f of fail) console.log(`  FAIL ${f}`);
  }
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(2);
});
