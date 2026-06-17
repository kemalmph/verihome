"use client";

import { useState, useTransition } from "react";
import { submitProperty } from "@/lib/actions/submit-property";

const CITY_NEIGHBORHOODS: Record<string, string[]> = {
  Jakarta: ["Kemang", "SCBD", "Senayan", "Sudirman", "Kuningan", "Menteng", "Other"],
};

export function ListYourPropertyForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [selectedCity, setSelectedCity] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitProperty(formData);
      setResult(res);
    });
  }

  if (result?.success) {
    return (
      <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm p-12 text-center space-y-4">
        <div className="w-16 h-16 bg-[#e8f5f0] rounded-full flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[#1a7a5e] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>
        <h2 className="text-2xl font-bold text-[#0d2137]">Submission received!</h2>
        <p className="text-[#3e4944] max-w-sm mx-auto">
          We&apos;ve sent a confirmation to your email. Our team will reach out within <strong>2 business days</strong> to schedule your RLA inspection.
        </p>
        <button
          onClick={() => setResult(null)}
          className="mt-4 px-6 py-2.5 border border-[#1a7a5e] text-[#1a7a5e] rounded-lg text-sm font-medium hover:bg-[#e8f5f0]"
        >
          Submit another property
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#cccccc] shadow-sm p-8 space-y-6">
      {result?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {result.error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
          Property Name *
        </label>
        <input
          name="name"
          type="text"
          required
          placeholder="e.g. Modern 2BR in Senayan"
          className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1] text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            City *
          </label>
          <select
            name="city"
            required
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
          >
            <option value="">Select city</option>
            <option value="Jakarta">Jakarta</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            Neighborhood *
          </label>
          <select
            name="area"
            required
            disabled={!selectedCity}
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select neighborhood</option>
            {(CITY_NEIGHBORHOODS[selectedCity] ?? []).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
          Address *
        </label>
        <input
          name="address"
          type="text"
          required
          placeholder="e.g. Jl. Kemang Raya No. 12, Jakarta Selatan"
          className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1] text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
          Google Maps Location URL
        </label>
        <input
          name="google_maps_url"
          type="url"
          placeholder="https://maps.google.com/..."
          className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1] text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            Property Type *
          </label>
          <select
            name="property_type"
            required
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
          >
            <option value="">Select type</option>
            <option value="apartment">Apartment</option>
            <option value="kost">Kost</option>
            <option value="house">House</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            Bedrooms *
          </label>
          <select
            name="bedrooms"
            required
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
          >
            <option value="studio">Studio</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4+">4+</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            Bathrooms *
          </label>
          <select
            name="bathrooms"
            required
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            Monthly Rent (IDR) *
          </label>
          <input
            name="price_monthly"
            type="number"
            required
            min="500000"
            placeholder="e.g. 6500000"
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1] text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
            Size (m²)
          </label>
          <input
            name="size_sqm"
            type="number"
            min="10"
            placeholder="e.g. 45"
            className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1] text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
          Description
        </label>
        <textarea
          name="description"
          rows={4}
          placeholder="Tell us about your property — what makes it special?"
          className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1] text-sm resize-none"
        />
      </div>

      <div className="border-t border-[#bec9c2] pt-6">
        <p className="text-sm font-semibold text-[#1b1c1c] mb-4">Owner Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
              Full Name *
            </label>
            <input
              name="owner_name"
              type="text"
              required
              placeholder="Your full name"
              className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
              Email *
            </label>
            <input
              name="owner_email"
              type="email"
              required
              placeholder="your@email.com"
              className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
              WhatsApp Number *
            </label>
            <input
              name="owner_phone"
              type="tel"
              required
              placeholder="+62 812-xxxx-xxxx"
              className="w-full h-12 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#1a7a5e] text-white py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            Submitting…
          </>
        ) : (
          "Submit Property"
        )}
      </button>

      <p className="text-xs text-center text-[#6e7a74]">
        Our team will review your submission and contact you within 2 business days.
      </p>
    </form>
  );
}
