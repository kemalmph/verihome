"use client";

import { useState, useTransition } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

interface VideoInputProps {
  propertyId: string;
  existingUrl: string | null;
  onUpdate: (url: string | null) => void;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
    }
  } catch {
    // invalid url
  }
  return null;
}

function isValidYouTubeUrl(url: string): boolean {
  return !!extractYouTubeId(url);
}

export function VideoInput({ propertyId, existingUrl, onUpdate }: VideoInputProps) {
  const [value, setValue] = useState(existingUrl ?? "");
  const [saved, setSaved] = useState(existingUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const videoId = saved ? extractYouTubeId(saved) : null;

  async function save() {
    setError(null);
    if (value && !isValidYouTubeUrl(value)) {
      setError("Please enter a valid YouTube URL (youtube.com/watch or youtu.be)");
      return;
    }
    const url = value.trim() || null;
    start(async () => {
      const res = await fetch("/api/admin/upload/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, videoUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }
      setSaved(url);
      onUpdate(url);
    });
  }

  function remove() {
    setValue("");
    setSaved(null);
    onUpdate(null);
    start(async () => {
      await fetch("/api/admin/upload/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, videoUrl: null }),
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block">
          YouTube Video URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 h-11 px-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm"
          />
          <button
            onClick={save}
            disabled={pending}
            className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {saved && (
            <button
              onClick={remove}
              className="px-3 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-xs text-[#6e7a74]">
          Upload video ke YouTube sebagai Unlisted, lalu paste link-nya di sini.
        </p>
      </div>

      {videoId && (
        <div className="rounded-xl overflow-hidden aspect-video bg-[#0d2137]">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
