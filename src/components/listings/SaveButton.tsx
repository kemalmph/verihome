"use client";

import { useState } from "react";
import { toggleSave } from "@/lib/supabase/save-actions";

interface SaveButtonProps {
  propertyId: string;
  initialSaved: boolean;
  onLoginRequired?: () => void;
  size?: "sm" | "md";
}

export function SaveButton({ propertyId, initialSaved, onLoginRequired, size = "md" }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    setPending(true);
    // Optimistic update
    setSaved((v) => !v);

    const result = await toggleSave(propertyId, saved);

    if (result.error === "unauthenticated") {
      setSaved(saved); // revert
      onLoginRequired?.();
    } else if (result.error) {
      setSaved(saved); // revert on any error
    }

    setPending(false);
  }

  const iconSize = size === "sm" ? "text-lg" : "text-2xl";
  const btnSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-label={saved ? "Unsave listing" : "Save listing"}
      className={`${btnSize} rounded-full flex items-center justify-center transition-all ${
        saved
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/90 text-[#6e7a74] hover:text-red-400 hover:bg-white"
      } shadow-sm border border-white/50 disabled:opacity-60`}
    >
      <span
        className={`material-symbols-outlined ${iconSize}`}
        style={{ fontVariationSettings: saved ? "'FILL' 1" : "'FILL' 0" }}
      >
        favorite
      </span>
    </button>
  );
}
