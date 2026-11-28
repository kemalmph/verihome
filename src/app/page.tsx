import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { pill, kicker } from "@/components/brand/styles";
import { getLocale } from "@/lib/i18n/server";
import { t, type StringKey } from "@/lib/i18n/strings";

/**
 * The marketing homepage — prototype V7 ("Run Your Space.").
 *
 * Copy: COSYSTEM_COPYWRITING_V7 (English), Indonesian alongside in
 * lib/i18n/strings.ts. Photos: COSYSTEM_PHOTO_ASSETS_FINAL. Icons: the six
 * feature SVGs from the prototype bundle, inlined so they inherit colour.
 *
 * Where a CTA names something that does not exist yet, it points at the
 * nearest real thing (see the comment on each). Section ids are anchor
 * targets for the header menu and are checked by
 * scripts/test-homepage-links.js.
 */

const FEATURES: { title: StringKey; desc: StringKey; icon: React.ReactNode }[] = [
  {
    title: "home.feat.book.t",
    desc: "home.feat.book.d",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" />
      </>
    ),
  },
  {
    title: "home.feat.member.t",
    desc: "home.feat.member.d",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    title: "home.feat.event.t",
    desc: "home.feat.event.d",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 9h18M12 12l1.2 2.2 2.5.4-1.8 1.8.4 2.5-2.3-1.2-2.3 1.2.4-2.5-1.8-1.8 2.5-.4z" />
      </>
    ),
  },
  {
    title: "home.feat.pay.t",
    desc: "home.feat.pay.d",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4M16 15h2" />
      </>
    ),
  },
  {
    title: "home.feat.space.t",
    desc: "home.feat.space.d",
    icon: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </>
    ),
  },
  {
    title: "home.feat.store.t",
    desc: "home.feat.store.d",
    icon: (
      <>
        <path d="M3 10.5 4.5 4h15L21 10.5" />
        <path d="M4 10.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2 2 0 0 0 2-2" />
        <path d="M5 12v8h14v-8M9 20v-5h6v5" />
      </>
    ),
  },
];

const MODELS: { img: string; tag: StringKey; title: StringKey; desc: StringKey; alt: StringKey }[] = [
  { img: "/images/home/model-coworking.jpg",       tag: "home.models.tagWork",  title: "home.models.cowork.t", desc: "home.models.cowork.d", alt: "home.models.cowork.a" },
  { img: "/images/home/model-serviced-office.jpg", tag: "home.models.tagWork",  title: "home.models.office.t", desc: "home.models.office.d", alt: "home.models.office.a" },
  { img: "/images/home/model-creative-hub.jpg",    tag: "home.models.tagMixed", title: "home.models.hub.t",    desc: "home.models.hub.d",    alt: "home.models.hub.a" },
  { img: "/images/home/model-hostel-coliving.jpg", tag: "home.models.tagLive",  title: "home.models.live.t",   desc: "home.models.live.d",   alt: "home.models.live.a" },
];

export default async function HomePage() {
  const lang = await getLocale();

  return (
    <>
      <Navbar />
      <main className="bg-white">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="relative isolate flex items-end md:items-center min-h-[610px] md:min-h-[560px] overflow-hidden bg-[#352d25]">
          <Image
            src="/images/home/hero-coworking.jpg"
            alt=""
            fill
            preload
            sizes="100vw"
            quality={80}
            className="-z-10 object-cover object-[58%_center] md:object-[center_52%]"
          />
          {/* Left-to-right scrim on desktop, bottom-up on a phone, where the
              copy sits at the bottom of a taller crop. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(15,17,18,.78)_0%,rgba(15,17,18,.45)_48%,rgba(15,17,18,.06)_100%)] md:bg-[linear-gradient(90deg,rgba(17,19,19,.72)_0%,rgba(17,19,19,.54)_35%,rgba(17,19,19,.08)_72%)]"
          />
          <div className="w-full max-w-[1160px] mx-auto px-4 md:px-6">
            <div className="max-w-[540px] pt-[90px] pb-[46px] md:py-[84px] text-white">
              <span className="inline-flex items-center rounded-full bg-white/[.17] border border-white/[.22] px-[13px] py-2 text-xs font-bold uppercase tracking-[0.04em]">
                {t("home.hero.eyebrow", lang)}
              </span>
              <h1 className="mt-6 mb-5 text-[61px] md:text-[clamp(54px,7vw,86px)] leading-[0.96] font-black tracking-[-0.055em]">
                {t("home.hero.title", lang)}
              </h1>
              <p className="max-w-[460px] text-base md:text-lg leading-[1.55] text-white/90 mb-7">
                {t("home.hero.sub", lang)}
              </p>
              <div className="flex flex-wrap gap-3">
                {/* No self-serve trial yet: the trial starts with the team. */}
                <Link href="/contact" className={pill.primary}>
                  {t("nav.startTrial", lang)} <span aria-hidden>→</span>
                </Link>
                {/* No demo video yet: this shows the product section below. */}
                <Link href="/#platform" className={`${pill.secondary} border-transparent bg-white/95`}>
                  <span aria-hidden className="text-brand text-xs">▶</span> {t("home.hero.demo", lang)}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-20 pt-8 pb-10 md:pt-[42px] md:pb-[58px]">
          <div className="max-w-[1160px] mx-auto px-4 md:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-6 sm:gap-x-[26px] sm:gap-y-7">
            {FEATURES.map((f) => (
              <article key={f.title} className="text-center px-2 py-1.5">
                <div className="mx-auto mb-[13px] grid place-items-center w-[54px] h-[54px] rounded-[17px] bg-brand-soft text-brand">
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="w-[25px] h-[25px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {f.icon}
                  </svg>
                </div>
                <h3 className="text-[15px] leading-tight font-extrabold tracking-[-0.02em] text-ink mb-[7px]">
                  {t(f.title, lang)}
                </h3>
                <p className="text-[13px] leading-normal text-ink-3">{t(f.desc, lang)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Product showcase ────────────────────────────────────── */}
        <section id="platform" className="scroll-mt-20 bg-cream-2 pt-9 pb-14 md:pt-[54px] md:pb-[82px]">
          <div className="max-w-[1160px] mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] items-center gap-9 lg:gap-[70px]">
            <div className="min-w-0">
              <Image
                src="/images/home/product-devices.png"
                alt={t("home.show.alt", lang)}
                width={1115}
                height={690}
                sizes="(min-width: 1024px) 640px, 100vw"
                className="w-full lg:w-[112%] lg:max-w-none lg:-ml-[5%] h-auto drop-shadow-[0_12px_16px_rgba(35,25,15,.08)]"
              />
            </div>
            <div>
              <p className={kicker}>{t("home.show.kicker", lang)}</p>
              <h2 className="mt-3.5 mb-[18px] text-[39px] md:text-[clamp(36px,4vw,52px)] leading-[1.02] font-extrabold tracking-[-0.046em] text-ink">
                {t("home.show.title", lang)}
              </h2>
              <p className="text-base leading-[1.65] text-ink-3 mb-[22px]">{t("home.show.sub", lang)}</p>
              <ul className="grid gap-3 mt-6">
                {(["home.show.c1", "home.show.c2", "home.show.c3"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-[11px] text-[15px] font-semibold text-ink">
                    <span aria-hidden className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-full bg-brand text-white text-[13px]">
                      ✓
                    </span>
                    {t(k, lang)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Space models ────────────────────────────────────────── */}
        <section id="solutions" className="scroll-mt-20 py-14 md:pt-[76px] md:pb-[84px]">
          <div className="max-w-[1160px] mx-auto px-4 md:px-6">
            <div className="text-center max-w-[720px] mx-auto mb-[25px] md:mb-[34px]">
              <p className={kicker}>{t("home.models.kicker", lang)}</p>
              <h2 className="mt-3 mb-3 text-[32px] md:text-[clamp(32px,4vw,44px)] leading-[1.08] font-extrabold tracking-[-0.04em] text-ink">
                {t("home.models.title", lang)}
              </h2>
              <p className="text-base text-ink-3">{t("home.models.sub", lang)}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {MODELS.map((m) => (
                <article
                  key={m.title}
                  className="overflow-hidden rounded-[15px] md:rounded-[19px] bg-cream border border-[#f3e9df] transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="relative h-[130px] md:h-[190px]">
                    <Image
                      src={m.img}
                      alt={t(m.alt, lang)}
                      fill
                      sizes="(min-width: 1024px) 280px, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3 md:px-[17px] md:pt-[17px] md:pb-[19px]">
                    <span className="inline-block mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
                      {t(m.tag, lang)}
                    </span>
                    <h3 className="text-sm md:text-[17px] font-bold tracking-[-0.02em] text-ink mb-[5px]">
                      {t(m.title, lang)}
                    </h3>
                    <p className="text-[11px] md:text-[13px] leading-[1.45] text-ink-3">{t(m.desc, lang)}</p>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-[22px] text-center text-[13px] text-ink-3">{t("home.models.note", lang)}</p>
          </div>
        </section>

        {/* ── Closing CTA ─────────────────────────────────────────── */}
        <section id="start" className="pb-12 md:pb-[78px]">
          <div className="max-w-[1160px] mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-7 rounded-3xl bg-[#fff2e7] border border-[#ffead9] p-6 md:px-[34px] md:py-7">
              <div className="flex items-center gap-3 md:gap-[18px]">
                <span aria-hidden className="text-4xl text-brand">↗</span>
                <h2 className="text-[23px] md:text-[25px] leading-[1.12] font-extrabold tracking-[-0.03em] text-ink max-w-[16ch]">
                  {t("home.cta.title", lang)}
                </h2>
              </div>
              <p className="text-[13px] md:text-sm text-ink-3 max-w-[330px]">{t("home.cta.sub", lang)}</p>
              <Link href="/contact" className={`${pill.primary} w-full md:w-auto`}>
                {t("home.cta.button", lang)} <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
