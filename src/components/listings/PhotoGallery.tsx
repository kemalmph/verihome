"use client";

import { useState } from "react";
import Image from "next/image";

interface PhotoGalleryProps {
  photos: string[];
  title: string;
}

export function PhotoGallery({ photos, title }: PhotoGalleryProps) {
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
