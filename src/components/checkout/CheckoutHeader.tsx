import Image from "next/image";
import Link from "next/link";
import { kicker } from "@/components/brand/styles";

/**
 * Top of the booking and viewing pages: which listing this is, with a way
 * back to it. A guest three steps into a payment should not have to wonder
 * what they are paying for.
 */
export function CheckoutHeader({
  slug,
  name,
  area,
  photo,
  backLabel,
  children,
}: {
  slug: string;
  name: string;
  area: string | null;
  photo?: string | null;
  backLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <Link
        href={`/listings/${slug}`}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink transition-colors"
      >
        <span aria-hidden className="material-symbols-outlined text-[18px]">arrow_back</span>
        {backLabel}
      </Link>

      <div className="mt-4 flex items-center gap-4">
        {photo && (
          <div className="relative shrink-0 w-[72px] h-[72px] md:w-20 md:h-20 rounded-2xl overflow-hidden bg-cream">
            <Image src={photo} alt="" fill sizes="80px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0">
          {area && <p className={kicker}>{area}</p>}
          <h1 className="mt-1 text-[26px] md:text-[32px] leading-[1.08] font-extrabold tracking-[-0.04em] text-ink">
            {name}
          </h1>
        </div>
      </div>

      {children && <div className="mt-4 text-sm text-ink-2 leading-relaxed">{children}</div>}
    </header>
  );
}
