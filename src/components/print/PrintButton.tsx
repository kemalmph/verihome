"use client";

/**
 * Opens the browser print dialog, where "Save as PDF" is the default
 * destination on every major platform. Preferred over a PDF library: the
 * document is already laid out in HTML, print CSS controls pagination, and it
 * adds no dependency to render what the page already renders.
 */
export function PrintButton({ label = "Unduh PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print px-5 py-2.5 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 inline-flex items-center gap-2"
    >
      <span className="material-symbols-outlined text-base">download</span>
      {label}
    </button>
  );
}
