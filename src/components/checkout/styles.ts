/** Shared class recipes for the booking and viewing flows (V7). */
export const flow = {
  card: "bg-white rounded-3xl border border-line shadow-card p-6 md:p-7 space-y-6",
  title: "text-xl font-extrabold tracking-[-0.03em] text-ink",
  label: "block text-xs font-semibold text-ink-2 mb-1.5",
  field:
    "w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink " +
    "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
  textarea:
    "w-full rounded-xl border border-line-strong bg-white px-3.5 py-3 text-sm text-ink resize-none " +
    "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
  error: "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;
