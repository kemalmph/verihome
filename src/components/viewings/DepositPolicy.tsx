import { viewingPolicyLines } from "@/lib/viewings/policy";

const TONE: Record<string, { dot: string; chip: string }> = {
  credit:  { dot: "bg-[#1a7a5e]", chip: "bg-[#e8f5f0] text-[#12614a]" },
  cash:    { dot: "bg-[#1f6fd0]", chip: "bg-blue-50 text-blue-800" },
  partial: { dot: "bg-[#c27c00]", chip: "bg-amber-50 text-amber-800" },
  forfeit: { dot: "bg-[#cf2f52]", chip: "bg-red-50 text-red-700" },
};

const LABEL: Record<string, string> = {
  credit:  "kredit / credit",
  cash:    "uang / cash",
  partial: "50%",
  forfeit: "hangus / forfeited",
};

/**
 * The deposit terms, bilingual, rendered identically wherever they appear.
 * Presentation only — the words come from lib/viewings/policy.
 */
export function DepositPolicy({ deposit }: { deposit: number }) {
  const lines = viewingPolicyLines(deposit);

  return (
    <div className="border border-[#cccccc] rounded-lg overflow-hidden">
      <div className="bg-[#f6f3f2] px-4 py-2.5 border-b border-[#e4e2e1]">
        <p className="font-semibold text-sm text-[#0d2137]">
          Ketentuan deposit viewing
          <span className="font-normal text-[#6e7a74]"> / Viewing deposit terms</span>
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
                  <p className="font-semibold text-sm text-[#0d2137]">
                    {l.id}
                    <span className="font-normal text-[#6e7a74]"> / {l.en}</span>
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${tone.chip}`}>
                    {LABEL[l.outcome]}
                  </span>
                </div>
                <p className="text-sm text-[#3e4944] mt-0.5">{l.idOutcome}</p>
                <p className="text-xs text-[#6e7a74] mt-0.5">{l.enOutcome}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
