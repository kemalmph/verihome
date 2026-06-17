import type { RLAAssessment } from "@/lib/supabase/queries";

interface RLAScoreProps {
  assessment: RLAAssessment;
}

const CATEGORIES: { key: keyof RLAAssessment; label: string }[] = [
  { key: "building_condition",  label: "Building Condition" },
  { key: "natural_lighting",    label: "Natural Lighting" },
  { key: "ventilation",         label: "Ventilation" },
  { key: "noise_level",         label: "Noise Level" },
  { key: "cleanliness",         label: "Cleanliness" },
  { key: "security_level",      label: "Security" },
  { key: "bathroom_condition",  label: "Bathroom" },
  { key: "furniture_quality",   label: "Furniture Quality" },
];

function scoreColor(score: number) {
  if (score >= 8) return "#1a7a5e";
  if (score >= 6) return "#3b82f6";
  if (score >= 4) return "#f59e0b";
  return "#ef4444";
}

export function RLAScore({ assessment }: RLAScoreProps) {
  const total = Number(assessment.rla_score).toFixed(1);

  return (
    <section className="bg-[#f6f3f2] p-6 rounded-xl space-y-6 border border-[#bec9c2]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-[#1b1c1c]">RLA Assessment</h2>
          <span
            className="material-symbols-outlined text-[#6e7a74] text-sm cursor-help"
            title="Rental Lifestyle Audit — Our independent scoring system"
          >
            info
          </span>
        </div>
        <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-[#bec9c2] shadow-sm">
          <span className="text-[#1a7a5e] text-xl font-semibold">{total}</span>
          <span className="text-[#3e4944] text-sm">/ 10</span>
          <span
            className="material-symbols-outlined text-[#1a7a5e] text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            star
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
        {CATEGORIES.map((cat) => {
          const score = assessment[cat.key] as number | null;
          if (score == null) return null;
          const pct = (score / 10) * 100;
          const color = scoreColor(score);
          return (
            <div key={cat.key} className="space-y-1.5">
              <div className="flex justify-between text-sm text-[#3e4944]">
                <span>{cat.label}</span>
                <span className="font-bold text-[#1b1c1c]">{score}/10</span>
              </div>
              <div className="w-full bg-[#e4e2e1] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {assessment.overall_notes && (
        <div className="p-4 bg-white border border-[#bec9c2] rounded-lg">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#1a7a5e]">notes</span>
            <p className="text-sm text-[#3e4944] italic">
              &ldquo;{assessment.overall_notes}&rdquo;
              <br />
              <span className="text-[#1b1c1c] font-bold mt-1 inline-block not-italic">
                — VeriHome Assessment Team
              </span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
