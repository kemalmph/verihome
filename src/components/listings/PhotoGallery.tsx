"use client";

import { useState, useEffect, useCallback } from "react";
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
  videoUrl?: string | null;
}

const TAB_LABELS: { key: keyof CategorizedPhotos; label: string; icon: string }[] = [
  { key: "exterior",   label: "Exterior",    icon: "home" },
  { key: "commonArea", label: "Common Area", icon: "meeting_room" },
  { key: "unit",       label: "Unit",        icon: "bed" },
  { key: "bathroom",   label: "Bathroom",    icon: "bathtub" },
];

// ── Lightbox ───────────────────────────────────────────────────────────────────

interface LightboxProps {
  photos: string[];
  initialIndex: number;
  categoryLabel: string;
  onClose: () => void;
}

function Lightbox({ photos, initialIndex, categoryLabel, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-3xl">close</span>
      </button>

      {/* Caption */}
      <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {categoryLabel} · {index + 1} / {photos.length}
      </p>

      {/* Image */}
      <div
        className="relative w-full max-w-4xl max-h-[80vh] aspect-video"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photos[index]}
          alt={`Photo ${index + 1}`}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>

      {/* Arrows */}
      <button
        onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
        aria-label="Previous"
      >
        <span className="material-symbols-outlined text-4xl">chevron_left</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
        aria-label="Next"
      >
        <span className="material-symbols-outlined text-4xl">chevron_right</span>
      </button>
    </div>
  );
}

// ── Video modal ────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    // invalid
  }
  return null;
}

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const id = extractYouTubeId(url);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {id ? (
          <iframe
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/50">Invalid video URL</div>
        )}
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
        <span className="material-symbols-outlined text-3xl">close</span>
      </button>
    </div>
  );
}

// ── Flat gallery ───────────────────────────────────────────────────────────────

function FlatGallery({ photos, title, videoUrl }: { photos: string[]; title: string; videoUrl?: string | null }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  if (!photos.length) {
    return (
      <div className="aspect-video bg-[#e4e2e1] rounded-xl flex items-center justify-center">
        <span className="material-symbols-outlined text-[#6e7a74] text-6xl">image</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden aspect-video group shadow-sm bg-[#eae8e7] cursor-pointer" onClick={() => setLightbox(0)}>
        <Image src={photos[0]} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" priority />
        <div className="absolute top-4 left-4">
          <span className="bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">verified</span>Curated
          </span>
        </div>
        {videoUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowVideo(true); }}
            className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-base">play_circle</span>
            Watch Video
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {photos.slice(1, 5).map((url, i) => (
            <button key={i} onClick={() => setLightbox(i + 1)} className="relative rounded-lg overflow-hidden aspect-video border-2 border-transparent hover:border-[#1a7a5e] transition-colors">
              <Image src={url} alt={`${title} ${i + 2}`} fill className="object-cover" />
              {i === 3 && photos.length > 5 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                  +{photos.length - 5}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && <Lightbox photos={photos} initialIndex={lightbox} categoryLabel="All" onClose={() => setLightbox(null)} />}
      {showVideo && videoUrl && <VideoModal url={videoUrl} onClose={() => setShowVideo(false)} />}
    </div>
  );
}

// ── Categorized gallery ────────────────────────────────────────────────────────

function CategorizedGallery({ categorized, title, videoUrl }: { categorized: CategorizedPhotos; title: string; videoUrl?: string | null }) {
  const availableTabs = TAB_LABELS.filter((t) => categorized[t.key].length > 0);
  const [activeTab, setActiveTab] = useState<keyof CategorizedPhotos>(availableTabs[0]?.key ?? "exterior");
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; label: string } | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  const allPhotos = availableTabs.flatMap((t) => categorized[t.key]);
  const currentPhotos = categorized[activeTab] ?? [];
  const currentLabel = TAB_LABELS.find((t) => t.key === activeTab)?.label ?? "";

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
      {/* Category tab bar */}
      <div className="flex gap-2 flex-wrap">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-[#1a7a5e] text-white" : "bg-[#e4e2e1] text-[#3e4944] hover:bg-[#bec9c2]"
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
            <span className="text-xs opacity-70">({categorized[tab.key].length})</span>
          </button>
        ))}
      </div>

      {/* Hero */}
      <div
        className="relative rounded-xl overflow-hidden aspect-video group shadow-sm bg-[#eae8e7] cursor-pointer"
        onClick={() => setLightbox({ photos: currentPhotos, index: activeIndex, label: currentLabel })}
      >
        {currentPhotos[activeIndex] && (
          <Image src={currentPhotos[activeIndex]} alt={`${title} — ${activeTab} ${activeIndex + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-700" priority={activeIndex === 0} />
        )}
        <div className="absolute top-4 left-4">
          <span className="bg-[#e8f5f0] text-[#1a7a5e] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">verified</span>Curated
          </span>
        </div>
        {videoUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowVideo(true); }}
            className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-base">play_circle</span>
            Watch Video
          </button>
        )}
        {currentPhotos.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
            {activeIndex + 1} / {currentPhotos.length}
          </div>
        )}
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
              }`}
            >
              <Image src={url} alt={`${title} ${activeTab} thumbnail ${i + 1}`} fill className="object-cover" />
              {i === 3 && currentPhotos.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                  +{currentPhotos.length - 4}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          categoryLabel={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}
      {showVideo && videoUrl && <VideoModal url={videoUrl} onClose={() => setShowVideo(false)} />}
    </div>
  );
}

// ── Public export ──────────────────────────────────────────────────────────────

export function PhotoGallery({ photos, categorized, title, videoUrl }: PhotoGalleryProps) {
  if (categorized) {
    const hasAny = Object.values(categorized).some((arr) => arr.length > 0);
    if (hasAny) return <CategorizedGallery categorized={categorized} title={title} videoUrl={videoUrl} />;
  }
  return <FlatGallery photos={photos ?? []} title={title} videoUrl={videoUrl} />;
}
