"use client";

import { useState } from "react";
import Image from "next/image";
import type { PropertyMedia } from "@/lib/types";

interface PhotoGalleryProps {
  media: PropertyMedia[];
  title: string;
}

export function PhotoGallery({ media, title }: PhotoGalleryProps) {
  const photos = media.filter((m) => m.media_type === "photo");
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex];

  if (!photos.length) {
    return (
      <div className="aspect-video bg-[#e4e2e1] rounded-xl flex items-center justify-center">
        <span className="material-symbols-outlined text-[#6e7a74] text-6xl">
          image
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden aspect-video group shadow-sm bg-[#eae8e7]">
        <Image
          src={activePhoto.url}
          alt={`${title} — photo ${activeIndex + 1}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700"
          priority={activeIndex === 0}
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">verified</span>
            Curated
          </span>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {photos.slice(0, 4).map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setActiveIndex(i)}
              className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-colors ${
                i === activeIndex
                  ? "border-[#1a7a5e]"
                  : "border-transparent hover:border-[#80d7b6]"
              }`}
            >
              <Image
                src={photo.url}
                alt={`${title} thumbnail ${i + 1}`}
                fill
                className="object-cover"
              />
              {i === 3 && photos.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
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
