"use client";

import { useState } from "react";
import Image from "next/image";

export interface CategorizedPhotos {
  exterior: string[];
  commonArea: string[];
  unit: string[];
  bathroom: string[];
}

interface PhotoGalleryProps {
  photos?: string[];
  categorized?: CategorizedPhotos;
  title: string;
}

const TAB_LABELS: { key: keyof CategorizedPhotos; label: string; icon: string }[] = [
  { key: "exterior",   label: "Exterior",    icon: "home" },
  { key: "commonArea", label: "Common Area", icon: "meeting_room" },
  { key: "unit",       label: "Unit",        icon: "bed" },
  { key: "bathroom",   label: "Bathroom",    icon: "bathtub" },
];

function FlatGallery({ photos, title }: { photos: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!photos.length) {
    return (
      <div className="aspect-video bg-[#e4e2e1] rounded-xl flex items-center justify-center">
        <span className="material-symbols-outlined text-[#6e7a74] text-6xl">image</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden aspect-video group shadow-sm bg-[#eae8e7]">
        <Image
          src={photos[activeIndex]}
          alt={`${title} — photo ${activeIndex + 1}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700"
          priority={activeIndex === 0}
        />
        <div className="absolute top-4 left-4">
          <span className="bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">verified</span>
            Curated
          </span>
        </div>
      </div>
      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {photos.slice(0, 4).map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-colors ${
                i === activeIndex ? "border-[#1a7a5e]" : "border-transparent hover:border-[#80d7b6]"
              } ${i === 3 && photos.length > 4 ? "bg-black" : ""}`}
            >
              <Image
                src={url}
                alt={`${title} thumbnail ${i + 1}`}
                fill
                className={`object-cover ${i === 3 && photos.length > 4 ? "opacity-50" : ""}`}
              />
              {i === 3 && photos.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                  +{photos.length - 4} photos
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CategorizedGallery({ categorized, title }: { categorized: CategorizedPhotos; title: string }) {
  const availableTabs = TAB_LABELS.filter((t) => categorized[t.key].length > 0);
  const [activeTab, setActiveTab] = useState<keyof CategorizedPhotos>(
    availableTabs[0]?.key ?? "exterior"
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const currentPhotos = categorized[activeTab] ?? [];

  if (availableTabs.length === 0) {
    return (
      <div className="aspect-video bg-[#e4e2e1] rounded-xl flex items-center justify-center">
        <span className="material-symbols-outlined text-[#6e7a74] text-6xl">image</span>
      </div>
    );
  }

  function handleTabChange(key: keyof CategorizedPhotos) {
    setActiveTab(key);
    setActiveIndex(0);
  }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[#1a7a5e] text-white"
                : "bg-[#e4e2e1] text-[#3e4944] hover:bg-[#bec9c2]"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
            <span className="text-xs opacity-70">({categorized[tab.key].length})</span>
          </button>
        ))}
      </div>

      {/* Main image */}
      <div className="relative rounded-xl overflow-hidden aspect-video group shadow-sm bg-[#eae8e7]">
        {currentPhotos[activeIndex] && (
          <Image
            src={currentPhotos[activeIndex]}
            alt={`${title} — ${activeTab} ${activeIndex + 1}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            priority={activeIndex === 0}
          />
        )}
        <div className="absolute top-4 left-4">
          <span className="bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">verified</span>
            Curated
          </span>
        </div>
      </div>

      {/* Thumbnails */}
      {currentPhotos.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {currentPhotos.slice(0, 4).map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-colors ${
                i === activeIndex ? "border-[#1a7a5e]" : "border-transparent hover:border-[#80d7b6]"
              } ${i === 3 && currentPhotos.length > 4 ? "bg-black" : ""}`}
            >
              <Image
                src={url}
                alt={`${title} ${activeTab} thumbnail ${i + 1}`}
                fill
                className={`object-cover ${i === 3 && currentPhotos.length > 4 ? "opacity-50" : ""}`}
              />
              {i === 3 && currentPhotos.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                  +{currentPhotos.length - 4} photos
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhotoGallery({ photos, categorized, title }: PhotoGalleryProps) {
  if (categorized) {
    const hasAny =
      categorized.exterior.length > 0 ||
      categorized.commonArea.length > 0 ||
      categorized.unit.length > 0 ||
      categorized.bathroom.length > 0;
    if (hasAny) return <CategorizedGallery categorized={categorized} title={title} />;
  }
  return <FlatGallery photos={photos ?? []} title={title} />;
}
