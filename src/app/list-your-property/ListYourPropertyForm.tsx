"use client";

import { useState, useTransition } from "react";
import { submitProperty } from "@/lib/actions/submit-property";
import { useT } from "@/lib/i18n/LocaleProvider";

const CITY_NEIGHBORHOODS: Record<string, string[]> = {
  Jakarta: ["Kemang", "SCBD", "Senayan", "Sudirman", "Kuningan", "Menteng", "Other"],
};

export function ListYourPropertyForm() {
  const t = useT();
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
      <div className="bg-white rounded-xl border border-line-strong shadow-sm p-12 text-center space-y-4">
        <div className="w-16 h-16 bg-brand-soft rounded-full flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-brand-ink text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>
        <h2 className="text-2xl font-bold text-ink">{t("lp.received")}</h2>
        <p className="text-ink-2 max-w-sm mx-auto">
          {t("lp.receivedBody")}
        </p>
        <button
          onClick={() => setResult(null)}
          className="mt-4 px-6 py-2.5 border border-brand text-brand-ink rounded-lg text-sm font-medium hover:bg-brand-soft"
        >
          {t("lp.another")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-line-strong shadow-sm p-8 space-y-6">
      {result?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {result.error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
          {t("lp.propertyName")}
        </label>
        <input
          name="name"
          type="text"
          required
          placeholder={t("lp.propertyNamePh")}
          className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.city")}
          </label>
          <select
            name="city"
            required
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm bg-white"
          >
            <option value="">{t("lp.selectCity")}</option>
            <option value="Jakarta">Jakarta</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.neighborhood")}
          </label>
          <select
            name="area"
            required
            disabled={!selectedCity}
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{t("lp.selectNeighborhood")}</option>
            {(CITY_NEIGHBORHOODS[selectedCity] ?? []).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
          {t("lp.address")}
        </label>
        <input
          name="address"
          type="text"
          required
          placeholder={t("lp.addressPh")}
          className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
          {t("lp.mapsUrl")}
        </label>
        <input
          name="google_maps_url"
          type="url"
          placeholder="https://maps.google.com/..."
          className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.propertyType")}
          </label>
          <select
            name="property_type"
            required
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm bg-white"
          >
            <option value="">{t("lp.selectType")}</option>
            <option value="apartment">{t("lp.apartment")}</option>
            <option value="kost">{t("lp.kost")}</option>
            <option value="house">{t("lp.house")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.bedrooms")}
          </label>
          <select
            name="bedrooms"
            required
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm bg-white"
          >
            <option value="studio">{t("lp.studio")}</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4+">4+</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.bathrooms")}
          </label>
          <select
            name="bathrooms"
            required
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm bg-white"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3+</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.monthlyRent")}
          </label>
          <input
            name="price_monthly"
            type="number"
            required
            min="500000"
            placeholder={t("lp.rentPh")}
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
            {t("lp.size")}
          </label>
          <input
            name="size_sqm"
            type="number"
            min="10"
            placeholder={t("lp.sizePh")}
            className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
          {t("lp.description")}
        </label>
        <textarea
          name="description"
          rows={4}
          placeholder={t("lp.descriptionPh")}
          className="w-full px-4 py-3 rounded-lg border border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light text-sm resize-none"
        />
      </div>

      <div className="border-t border-line-strong pt-6">
        <p className="text-sm font-semibold text-ink mb-4">{t("lp.ownerDetails")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
              {t("lp.fullName")}
            </label>
            <input
              name="owner_name"
              type="text"
              required
              placeholder={t("lp.fullNamePh")}
              className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
              {t("lp.emailLabel")}
            </label>
            <input
              name="owner_email"
              type="email"
              required
              placeholder="your@email.com"
              className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
              {t("lp.whatsapp")}
            </label>
            <input
              name="owner_phone"
              type="tel"
              required
              placeholder="+62 812-xxxx-xxxx"
              className="w-full h-12 px-4 rounded-lg border border-line-strong focus:border-brand focus:outline-none text-sm"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            {t("lp.submitting")}
          </>
        ) : (
          t("lp.submit")
        )}
      </button>

      <p className="text-xs text-center text-ink-3">
        {t("lp.footnote")}
      </p>
    </form>
  );
}
