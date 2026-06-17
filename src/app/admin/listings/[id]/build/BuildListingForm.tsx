"use client";

import { useState, useTransition } from "react";
import { saveBuildListing } from "@/lib/actions/build-listing-actions";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PropertyData {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  property_type: string | null;
  price_monthly: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  min_stay_months: number | null;
  google_maps_url: string | null;
}

export interface RLAData {
  building_condition: number | null;
  natural_lighting: number | null;
  ventilation: number | null;
  noise_level: number | null;
  cleanliness: number | null;
  security_level: number | null;
  bathroom_condition: number | null;
  furniture_quality: number | null;
  pros: string[];
  cons: string[];
  overall_notes: string | null;
}

export interface AreaData {
  nearest_mrt: string | null;
  mrt_distance: string | null;
  nearest_transjakarta: string | null;
  transjakarta_distance: string | null;
  nearest_minimarket: string | null;
  nearest_clinic: string | null;
  nearest_food: string | null;
  nearest_gym: string | null;
  neighborhood_character: string | null;
  expat_friendly: number | null;
  time_to_scbd_min: number | null;
  time_to_sudirman_min: number | null;
  area_notes: string | null;
}

export interface DetailsData {
  facilities: string[];
  included_utilities: string[];
  rules: string | null;
  additional_notes: string | null;
}

interface BuildListingFormProps {
  property: PropertyData;
  rla: RLAData | null;
  area: AreaData | null;
  details: DetailsData | null;
  formRef: React.RefObject<HTMLFormElement | null>;
  onDirty: () => void;
  onClean: () => void;
}

// ── Shared styles ──────────────────────────────────────────────────────────

const input = "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white";
const labelCls = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";
const sectionCls = "bg-white rounded-xl border border-[#cccccc] shadow-sm p-6 space-y-5";

// ── Score slider ────────────────────────────────────────────────────────────

function ScoreInput({
  name,
  labelText,
  defaultValue,
  onFirstChange,
}: {
  name: string;
  labelText: string;
  defaultValue: number | null;
  onFirstChange?: () => void;
}) {
  const [val, setVal] = useState(defaultValue ?? 0);
  const pct = (val / 10) * 100;
  const color = val >= 8 ? "#1a7a5e" : val >= 6 ? "#3b82f6" : val >= 4 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm text-[#3e4944]">{labelText}</label>
        <span className="text-sm font-bold text-[#0d2137] w-12 text-right">{val} / 10</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          name={name}
          min={0}
          max={10}
          step={1}
          value={val}
          onChange={(e) => {
            setVal(Number(e.target.value));
            onFirstChange?.();
          }}
          className="flex-1 accent-[#1a7a5e] h-2"
        />
        <div className="w-24 bg-[#e4e2e1] h-2 rounded-full overflow-hidden flex-shrink-0">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────

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

// ── Main form ──────────────────────────────────────────────────────────────

export function BuildListingForm({ property, rla, area, details, formRef, onDirty, onClean }: BuildListingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [dirtyFired, setDirtyFired] = useState(false);

  function markDirty() {
    if (!dirtyFired) {
      setDirtyFired(true);
      onDirty();
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveBuildListing(property.id, formData);
      setSaved(true);
      setDirtyFired(false);
      onClean();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const scoreSliders = [
    { name: "building_condition",  label: "Building Condition",  val: rla?.building_condition  ?? null },
    { name: "natural_lighting",    label: "Natural Lighting",    val: rla?.natural_lighting    ?? null },
    { name: "ventilation",         label: "Ventilation",         val: rla?.ventilation         ?? null },
    { name: "noise_level",         label: "Noise Level",         val: rla?.noise_level         ?? null },
    { name: "cleanliness",         label: "Cleanliness",         val: rla?.cleanliness         ?? null },
    { name: "security_level",      label: "Security",            val: rla?.security_level      ?? null },
    { name: "bathroom_condition",  label: "Bathroom Condition",  val: rla?.bathroom_condition  ?? null },
    { name: "furniture_quality",   label: "Furniture Quality",   val: rla?.furniture_quality   ?? null },
  ];

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={markDirty}
      className="space-y-8"
    >
      {saved && (
        <div className="flex items-center gap-3 p-4 bg-[#e8f5f0] border border-[#9cf4d1] rounded-xl text-sm text-[#1a7a5e] font-medium">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Saved — listing moved to <strong>Draft</strong>. Review the publish checklist when ready.
        </div>
      )}

      {/* Property Info */}
      <div className={sectionCls}>
        <SectionHeading icon="apartment" title="Property Info" subtitle="Basic details visible to tenants" />
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Property Name *</label>
            <input name="name" required defaultValue={property.name} className={input} />
          </div>
          <div>
            <label className={labelCls}>Area / Neighborhood *</label>
            <select name="area" defaultValue={property.area ?? ""} className={input}>
              {["Kemang","SCBD","Senayan","Sudirman","Kuningan","Menteng","Other"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type *</label>
            <select name="property_type" defaultValue={property.property_type ?? ""} className={input}>
              <option value="apartment">Apartment</option>
              <option value="kost">Kost</option>
              <option value="house">House</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Address</label>
            <input name="address" defaultValue={property.address ?? ""} placeholder="Jl. Kemang Raya No. 12" className={input} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Google Maps URL</label>
            <input name="google_maps_url" type="url" defaultValue={property.google_maps_url ?? ""} placeholder="https://maps.google.com/..." className={input} />
          </div>
          <div>
            <label className={labelCls}>Price / Month (IDR) *</label>
            <input name="price_monthly" type="number" required defaultValue={property.price_monthly ?? ""} placeholder="6500000" className={input} />
          </div>
          <div>
            <label className={labelCls}>Min Stay (months)</label>
            <input name="min_stay_months" type="number" min="1" defaultValue={property.min_stay_months ?? 1} className={input} />
          </div>
          <div>
            <label className={labelCls}>Bedrooms</label>
            <input name="bedrooms" type="number" min="0" defaultValue={property.bedrooms ?? ""} className={input} />
          </div>
          <div>
            <label className={labelCls}>Bathrooms</label>
            <input name="bathrooms" type="number" min="1" defaultValue={property.bathrooms ?? ""} className={input} />
          </div>
          <div>
            <label className={labelCls}>Size (m²)</label>
            <input name="size_sqm" type="number" defaultValue={property.size_sqm ?? ""} className={input} />
          </div>
        </div>
      </div>

      {/* RLA Assessment */}
      <div className={sectionCls}>
        <SectionHeading icon="verified_user" title="RLA Assessment" subtitle="Rate each category 0–10 based on your on-site inspection" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
          {scoreSliders.map((cat) => (
            <ScoreInput
              key={cat.name}
              name={cat.name}
              labelText={cat.label}
              defaultValue={cat.val}
              onFirstChange={markDirty}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className={labelCls}>Pros (one per line, min 2)</label>
            <textarea
              name="pros"
              rows={4}
              defaultValue={(rla?.pros ?? []).join("\n")}
              placeholder={"Great natural light\nClose to MRT\nResponsive owner"}
              className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
            />
          </div>
          <div>
            <label className={labelCls}>Cons (one per line, min 2)</label>
            <textarea
              name="cons"
              rows={4}
              defaultValue={(rla?.cons ?? []).join("\n")}
              placeholder={"No dedicated parking\nSmall balcony"}
              className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Overall Notes (optional)</label>
            <textarea
              name="overall_notes"
              rows={3}
              defaultValue={rla?.overall_notes ?? ""}
              placeholder="General impression of the property…"
              className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Area Overview */}
      <div className={sectionCls}>
        <SectionHeading icon="map" title="Area Overview" subtitle="Nearest transit, amenities and neighbourhood feel" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nearest MRT Station</label>
            <input name="nearest_mrt" defaultValue={area?.nearest_mrt ?? ""} placeholder="Blok M BCA" className={input} />
          </div>
          <div>
            <label className={labelCls}>MRT Distance / Walk Time</label>
            <input name="mrt_distance" defaultValue={area?.mrt_distance ?? ""} placeholder="7 min walk" className={input} />
          </div>
          <div>
            <label className={labelCls}>Nearest TransJakarta Stop</label>
            <input name="nearest_transjakarta" defaultValue={area?.nearest_transjakarta ?? ""} placeholder="Halte Blok M" className={input} />
          </div>
          <div>
            <label className={labelCls}>TransJakarta Distance</label>
            <input name="transjakarta_distance" defaultValue={area?.transjakarta_distance ?? ""} placeholder="3 min walk" className={input} />
          </div>
          <div>
            <label className={labelCls}>Nearest Minimarket</label>
            <input name="nearest_minimarket" defaultValue={area?.nearest_minimarket ?? ""} placeholder="Alfamart Kemang" className={input} />
          </div>
          <div>
            <label className={labelCls}>Nearest Clinic / Puskesmas</label>
            <input name="nearest_clinic" defaultValue={area?.nearest_clinic ?? ""} placeholder="Klinik Pratama Kemang" className={input} />
          </div>
          <div>
            <label className={labelCls}>Nearest Food / Warung Makan</label>
            <input name="nearest_food" defaultValue={area?.nearest_food ?? ""} placeholder="Warung Bu Sari" className={input} />
          </div>
          <div>
            <label className={labelCls}>Nearest Gym / Fitness</label>
            <input name="nearest_gym" defaultValue={area?.nearest_gym ?? ""} placeholder="Celebrity Fitness Kemang" className={input} />
          </div>
          <div>
            <label className={labelCls}>Time to SCBD (min drive)</label>
            <input name="time_to_scbd_min" type="number" defaultValue={area?.time_to_scbd_min ?? ""} className={input} />
          </div>
          <div>
            <label className={labelCls}>Time to Sudirman (min drive)</label>
            <input name="time_to_sudirman_min" type="number" defaultValue={area?.time_to_sudirman_min ?? ""} className={input} />
          </div>
          <div>
            <label className={labelCls}>Neighbourhood Character</label>
            <select name="neighborhood_character" defaultValue={area?.neighborhood_character ?? "mixed"} className={input}>
              <option value="quiet">Tenang (Quiet)</option>
              <option value="mixed">Mixed</option>
              <option value="busy">Ramai (Busy)</option>
            </select>
          </div>
        </div>
        <div>
          <ScoreInput
            name="expat_friendly"
            labelText="Expat-Friendly Score"
            defaultValue={area?.expat_friendly ?? 5}
            onFirstChange={markDirty}
          />
          <p className="text-xs text-[#6e7a74] mt-1">0 = very local · 10 = fully expat-friendly</p>
        </div>
        <div>
          <label className={labelCls}>Area Notes (optional)</label>
          <textarea
            name="area_notes"
            rows={2}
            defaultValue={area?.area_notes ?? ""}
            placeholder="Anything else a tenant should know about the location…"
            className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
          />
        </div>
      </div>

      {/* Facilities & Rules */}
      <div className={sectionCls}>
        <SectionHeading icon="checklist" title="Facilities & Rules" subtitle="What's included and house rules" />
        <div>
          <label className={labelCls}>Facilities (comma or line separated)</label>
          <textarea
            name="facilities"
            rows={3}
            defaultValue={(details?.facilities ?? []).join(", ")}
            placeholder="AC, WiFi, Furnished, Water Heater, Parking, Gym, Pool…"
            className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className={labelCls}>Included Utilities</label>
          <textarea
            name="included_utilities"
            rows={2}
            defaultValue={(details?.included_utilities ?? []).join(", ")}
            placeholder="Water, Electricity up to 50kWh, WiFi…"
            className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className={labelCls}>House Rules</label>
          <textarea
            name="rules"
            rows={3}
            defaultValue={details?.rules ?? ""}
            placeholder="No smoking, No pets, Quiet hours 10pm–7am…"
            className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className={labelCls}>Additional Notes (internal only)</label>
          <textarea
            name="additional_notes"
            rows={2}
            defaultValue={details?.additional_notes ?? ""}
            className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm resize-none"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#1a7a5e] text-white py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Saving…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined">save</span>
            Save as Draft
          </>
        )}
      </button>
    </form>
  );
}
