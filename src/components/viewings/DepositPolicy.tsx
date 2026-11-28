"use client";

import { viewingPolicyLines } from "@/lib/viewings/policy";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { t, type StringKey } from "@/lib/i18n/strings";

const TONE: Record<string, { dot: string; chip: string }> = {
  credit:  { dot: "bg-brand", chip: "bg-success-soft text-success-ink" },
  cash:    { dot: "bg-[#1f6fd0]", chip: "bg-blue-50 text-blue-800" },
  partial: { dot: "bg-[#c27c00]", chip: "bg-amber-50 text-amber-800" },
  forfeit: { dot: "bg-[#cf2f52]", chip: "bg-red-50 text-red-700" },
};

const LABEL: Record<string, StringKey> = {
  credit:  "policy.credit",
  cash:    "policy.cash",
  partial: "policy.partial",
  forfeit: "policy.forfeit",
};

/**
 * The deposit terms, rendered identically wherever they appear.
 *
 * These used to print Indonesian and English stacked on every line, because
 * there was no language switch to choose between them. There is now, so the
 * reader gets one language — the one they asked for. The words themselves
 * still come from lib/viewings/policy, which holds both.
 *
 * A client component because ViewingFlow — itself client — renders it. An
 * async server component cannot be rendered from there at all.
 */
export function DepositPolicy({ deposit }: { deposit: number }) {
  const lang = useLocale();
  const lines = viewingPolicyLines(deposit);

  return (
    <div className="border border-line-strong rounded-lg overflow-hidden">
      <div className="bg-canvas px-4 py-2.5 border-b border-line">
        <p className="font-semibold text-sm text-ink">
          {t("policy.title", lang)}
        </p>
      </div>

      <ul className="divide-y divide-[#f0eeed]">
        {lines.map((l) => {
          const tone = TONE[l.outcome];
          return (
            <li key={l.id} className="px-4 py-3 flex gap-3">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className="font-semibold text-sm text-ink">
                    {lang === "en" ? l.en : l.id}
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${tone.chip}`}>
                    {t(LABEL[l.outcome], lang)}
                  </span>
                </div>
                <p className="text-sm text-ink-2 mt-0.5">
                  {lang === "en" ? l.enOutcome : l.idOutcome}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
