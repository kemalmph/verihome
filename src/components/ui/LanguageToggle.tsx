"use client";

import { useState } from "react";

export function LanguageToggle() {
  const [lang, setLang] = useState<"EN" | "ID">("EN");

  return (
    <div className="flex items-center bg-[#f6f3f2] px-3 py-1 rounded-full text-xs font-medium select-none">
      <button
        onClick={() => setLang("EN")}
        className={lang === "EN" ? "text-[#1a7a5e] font-bold" : "text-[#6e7a74]"}
      >
        EN
      </button>
      <span className="mx-2 text-[#bec9c2]">|</span>
      <button
        onClick={() => setLang("ID")}
        className={lang === "ID" ? "text-[#1a7a5e] font-bold" : "text-[#6e7a74]"}
      >
        ID
      </button>
    </div>
  );
}
