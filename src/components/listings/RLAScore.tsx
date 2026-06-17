import type { PropertyDetailRow } from "@/lib/supabase/queries";

type RLA = PropertyDetailRow["rla_assessments"][number];

interface RLAScoreProps {
  assessment: RLA;
}

const categories = [
  { key: "building_condition" as const, label: "Building Condition" },
  { key: "natural_lighting" as const, label: "Natural Lighting" },
  { key: "bathroom_condition" as const, label: "Bathroom" },
  { key: "ventilation" as const, label: "Ventilation" },
];

export function RLAScore({ assessment }: RLAScoreProps) {
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
          <span className="text-[#1a7a5e] text-xl font-semibold">
            {Number(assessment.rla_score).toFixed(1)}
          </span>
          <span className="text-[#3e4944] text-sm">/ 5</span>
          <span
            className="material-symbols-outlined text-[#1a7a5e] text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            star
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
        {categories.map((cat) => {
          const score = assessment[cat.key] as number;
          const pct = (score / 5) * 100;
          return (
            <div key={cat.key} className="space-y-1.5">
              <div className="flex justify-between text-sm text-[#3e4944]">
                <span>{cat.label}</span>
                <span className="font-bold text-[#1b1c1c]">{score}/5</span>
              </div>
              <div className="w-full bg-[#e4e2e1] h-2 rounded-full overflow-hidden">
                <div className="bg-[#1a7a5e] h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <span className="bg-[#cee1ff] text-[#52647d] px-3 py-1 rounded-full text-xs font-medium capitalize">
          Noise: {assessment.noise_level}
        </span>
        <span className="bg-[#9cf4d1] text-[#00513c] px-3 py-1 rounded-full text-xs font-medium capitalize">
          Security: {assessment.security_level}
        </span>
        <span className="bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-medium capitalize">
          Water: {assessment.water_pressure}
        </span>
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
