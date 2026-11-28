"use client";

import { useState } from "react";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { VideoInput } from "@/components/admin/VideoInput";
import type { PhotoCategory } from "@/types/property";

interface MediaSectionProps {
  propertyId: string;
  initialMedia: {
    photos_exterior: string[];
    photos_common_area: string[];
    photos_unit: string[];
    photos_bathroom: string[];
    video_url: string | null;
  } | null;
}

const TABS: {
  category: PhotoCategory;
  label: string;
  labelId: string;
  description: string;
  min: number;
}[] = [
  {
    category: "exterior",
    label: "Exterior",
    labelId: "Foto Eksterior",
    description: "Tampak depan, papan nama, parkir, akses masuk",
    min: 3,
  },
  {
    category: "common_area",
    label: "Common Area",
    labelId: "Area Bersama",
    description: "Lobby, koridor, lift/tangga, dapur bersama, laundry",
    min: 2,
  },
  {
    category: "unit",
    label: "Unit",
    labelId: "Unit / Kamar",
    description: "Tampak kamar, sudut kiri/kanan, kasur, lemari, meja kerja, jendela, AC, TV, furnitur",
    min: 6,
  },
  {
    category: "bathroom",
    label: "Bathroom",
    labelId: "Kamar Mandi",
    description: "Tampak keseluruhan, shower, closet, wastafel, water heater",
    min: 2,
  },
];

export function MediaSection({ propertyId, initialMedia }: MediaSectionProps) {
  const [activeTab, setActiveTab] = useState<PhotoCategory>("exterior");
  const [photos, setPhotos] = useState({
    exterior:    initialMedia?.photos_exterior    ?? [],
    common_area: initialMedia?.photos_common_area ?? [],
    unit:        initialMedia?.photos_unit        ?? [],
    bathroom:    initialMedia?.photos_bathroom    ?? [],
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(initialMedia?.video_url ?? null);

  const total = Object.values(photos).reduce((sum, arr) => sum + arr.length, 0);
  const meetsMinimum = total >= 15;

  function handlePhotosUpdate(category: PhotoCategory, newPhotos: string[]) {
    setPhotos((prev) => ({ ...prev, [category]: newPhotos }));
  }

  const activeConfig = TABS.find((t) => t.category === activeTab)!;

  return (
    <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
      {/* Section header */}
      <div className="px-6 py-5 border-b border-[#e8e8e8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-ink">photo_library</span>
          <h2 className="font-semibold text-ink">Media</h2>
        </div>
        <span className={`text-sm font-bold ${meetsMinimum ? "text-brand-ink" : "text-amber-600"}`}>
          Total: {total} / 25 foto
          {!meetsMinimum && <span className="font-normal text-ink-3 ml-1">(min 15)</span>}
        </span>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-[#e8e8e8] overflow-x-auto">
        {TABS.map((tab) => {
          const count = photos[tab.category].length;
          const active = activeTab === tab.category;
          return (
            <button
              key={tab.category}
              onClick={() => setActiveTab(tab.category)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-brand text-brand-ink bg-[#f0faf5]"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                count >= tab.min ? "bg-brand-soft text-brand-ink" : "bg-canvas text-ink-3"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active category */}
      <div className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-ink text-sm">{activeConfig.labelId}</h3>
          <p className="text-xs text-ink-3 mt-0.5">{activeConfig.description}</p>
        </div>
        <PhotoUpload
          propertyId={propertyId}
          category={activeTab}
          existingPhotos={photos[activeTab]}
          onUpdate={(newPhotos) => handlePhotosUpdate(activeTab, newPhotos)}
          minPhotos={activeConfig.min}
          maxPhotos={25}
        />
      </div>

      {/* Video URL */}
      <div className="px-6 pb-6 pt-2 border-t border-[#e8e8e8] mt-2">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-ink text-base">videocam</span>
          <h3 className="font-semibold text-ink text-sm">Video Walkthrough</h3>
        </div>
        <VideoInput
          propertyId={propertyId}
          existingUrl={videoUrl}
          onUpdate={setVideoUrl}
        />
      </div>
    </div>
  );
}
