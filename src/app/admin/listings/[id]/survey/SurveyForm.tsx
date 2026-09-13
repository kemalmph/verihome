"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSurvey } from "@/lib/actions/survey-actions";

const input = "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white";
const area = "w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white";
const labelCls = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";
const sectionCls = "bg-white rounded-xl border border-[#cccccc] shadow-sm p-6 space-y-5";

const SCORES = [
  { name: "building_condition", label: "Building Condition", hint: "Structure, walls, fittings" },
  { name: "natural_lighting",   label: "Natural Lighting",   hint: "Daylight reaching the unit" },
  { name: "ventilation",        label: "Ventilation",        hint: "Airflow, damp, smell" },
  { name: "noise_level",        label: "Quietness",          hint: "10 = very quiet" },
  { name: "cleanliness",        label: "Cleanliness",        hint: "Unit and common areas" },
  { name: "security_level",     label: "Security",           hint: "Guard, gate, CCTV" },
  { name: "bathroom_condition", label: "Bathroom Condition",  hint: "Fixtures, water pressure" },
  { name: "furniture_quality",  label: "Furniture Quality",   hint: "Condition and completeness" },
] as const;

function SectionHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b border-[#e4e2e1]">
      <span className="material-symbols-outlined text-[#1a7a5e] text-xl mt-0.5">{icon}</span>
      <div>
        <h3 className="font-semibold text-[#0d2137]">{title}</h3>
        {subtitle && <p className="text-xs text-[#6e7a74] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ScoreSlider({ name, label, hint }: { name: string; label: string; hint: string }) {
  const [val, setVal] = useState(5);
  const pct = val * 10;
  const color = val >= 8 ? "#1a7a5e" : val >= 5 ? "#d99a2b" : "#c0492f";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className={labelCls} style={{ display: "inline" }}>{label}</span>
          <span className="text-xs text-[#6e7a74] ml-2 normal-case tracking-normal">{hint}</span>
        </div>
        <span className="text-sm font-bold text-[#0d2137] w-14 text-right tabular-nums">{val} / 10</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range" name={name} min={0} max={10} step={1}
          value={val} onChange={(e) => setVal(Number(e.target.value))}
          className="flex-1 accent-[#1a7a5e] h-2"
        />
        <div className="w-20 bg-[#e4e2e1] h-2 rounded-full overflow-hidden flex-shrink-0">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

function Field({ name, label, placeholder, hint, type = "text" }: {
  name: string; label: string; placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <div>
      <label className={labelCls} htmlFor={name}>
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-[#aaa] ml-1.5">{hint}</span>}
      </label>
      <input id={name} name={name} type={type} placeholder={placeholder} className={input} />
    </div>
  );
}

export function SurveyForm({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await submitSurvey(propertyId, formData);
      if (res?.error) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/admin/listings/${propertyId}/build`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      {/* Visit */}
      <div className={sectionCls}>
        <SectionHeading icon="assignment_ind" title="The visit" subtitle={`Site visit record for ${propertyName}`} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="survey_date">Survey Date</label>
            <input
              id="survey_date" name="survey_date" type="date"
              defaultValue={new Date().toISOString().slice(0, 10)} className={input}
            />
          </div>
          <Field name="surveyor_name" label="Surveyor Name *" placeholder="Who visited" />
          <Field name="pic_name" label="PIC on site" placeholder="Owner or caretaker met" />
          <Field name="pic_whatsapp" label="PIC WhatsApp" placeholder="08xx xxxx xxxx" />
          <Field name="duration_minutes" label="Duration" hint="minutes" type="number" placeholder="45" />
          <Field name="video_walkthrough_url" label="Walkthrough Video" hint="optional" placeholder="https://…" />
        </div>
      </div>

      {/* RLA */}
      <div className={sectionCls}>
        <SectionHeading
          icon="rule"
          title="Rental Lifestyle Audit"
          subtitle="Score each dimension 0–10 from what you observed on site"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {SCORES.map((s) => <ScoreSlider key={s.name} {...s} />)}
        </div>
      </div>

      {/* Verdict */}
      <div className={sectionCls}>
        <SectionHeading icon="fact_check" title="Verdict" subtitle="One item per line. At least two of each." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="pros">Pros</label>
            <textarea id="pros" name="pros" rows={5} className={area}
              placeholder={"Bright corner unit\nMRT 6 min on foot\nResponsive building manager"} />
          </div>
          <div>
            <label className={labelCls} htmlFor="cons">Cons</label>
            <textarea id="cons" name="cons" rows={5} className={area}
              placeholder={"Street noise until late\nNo dedicated parking\nShower pressure weak"} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="overall_notes">Overall Notes</label>
          <textarea id="overall_notes" name="overall_notes" rows={3} className={area}
            placeholder="Anything a tenant would want to know that the scores don't capture." />
        </div>
      </div>

      {/* Area */}
      <div className={sectionCls}>
        <SectionHeading icon="explore" title="Area overview" subtitle="Transit, amenities, and the feel of the street" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field name="nearest_mrt" label="Nearest MRT" placeholder="Blok M" />
          <Field name="mrt_distance" label="MRT Distance" placeholder="1.2 km" />
          <Field name="nearest_transjakarta" label="Nearest TransJakarta" placeholder="Halte Kemang" />
          <Field name="transjakarta_distance" label="TransJakarta Distance" placeholder="600 m" />
          <Field name="walk_time_to_transit_min" label="Walk to Transit" hint="minutes" type="number" placeholder="8" />
          <Field name="nearest_minimarket" label="Nearest Minimarket" placeholder="Indomaret, 200 m" />
          <Field name="nearest_clinic" label="Nearest Clinic" placeholder="Klinik Kemang Medical" />
          <Field name="nearest_food" label="Food Nearby" placeholder="Warung and cafés on Jl. Kemang Raya" />
          <Field name="nearest_gym" label="Nearest Gym" placeholder="Gold's Gym, 1 km" />
          <div>
            <label className={labelCls} htmlFor="neighborhood_character">Neighbourhood Character</label>
            <select id="neighborhood_character" name="neighborhood_character" defaultValue="mixed" className={input}>
              <option value="quiet">Quiet — residential, low traffic</option>
              <option value="mixed">Mixed — residential with some commercial</option>
              <option value="busy">Busy — commercial, high traffic</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <div>
              <span className={labelCls} style={{ display: "inline" }}>Expat Friendly</span>
              <span className="text-xs text-[#6e7a74] ml-2 normal-case tracking-normal">
                English spoken, international amenities
              </span>
            </div>
          </div>
          <ExpatSlider />
        </div>

        <div>
          <label className={labelCls} htmlFor="area_notes">Area Notes</label>
          <textarea id="area_notes" name="area_notes" rows={3} className={area}
            placeholder="Flooding history, construction nearby, weekend traffic — anything seasonal or non-obvious." />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit" disabled={isPending}
          className="flex-1 bg-[#1a7a5e] text-white py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <><span className="material-symbols-outlined animate-spin">progress_activity</span> Saving survey…</>
          ) : (
            <><span className="material-symbols-outlined">save</span> Save Survey</>
          )}
        </button>
      </div>
      <p className="text-xs text-[#6e7a74] text-center">
        Saving records the visit and marks the RLA and area overview complete on the publish checklist.
      </p>
    </form>
  );
}

function ExpatSlider() {
  const [val, setVal] = useState(5);
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" name="expat_friendly" min={0} max={10} step={1}
        value={val} onChange={(e) => setVal(Number(e.target.value))}
        className="flex-1 accent-[#1a7a5e] h-2"
      />
      <span className="text-sm font-bold text-[#0d2137] w-14 text-right tabular-nums">{val} / 10</span>
    </div>
  );
}
