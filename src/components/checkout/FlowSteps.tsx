/**
 * The three-step indicator at the top of the booking and viewing flows.
 * Done steps get a tick, the current one is the orange pill, the rest wait
 * in grey. `aria-current="step"` marks where the guest is for screen readers.
 */
export function FlowSteps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2 text-[13px]">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "todo";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "now" ? "step" : undefined}>
            <span
              className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 font-semibold transition-colors ${
                state === "now" ? "pr-3.5" : "pr-1.5 sm:pr-3.5"
              } ${
                state === "now"
                  ? "bg-brand text-white shadow-brand"
                  : state === "done"
                    ? "bg-brand-soft text-brand-ink"
                    : "bg-canvas text-ink-3"
              }`}
            >
              <span
                aria-hidden
                className={`grid place-items-center w-6 h-6 rounded-full text-xs font-bold ${
                  state === "now" ? "bg-white/25" : "bg-white"
                }`}
              >
                {state === "done" ? "✓" : n}
              </span>
              {/* On a phone only the current step keeps its name; the
                  others shrink to their number so the row fits on one line. */}
              <span className={state === "now" ? "" : "sr-only sm:not-sr-only"}>{label}</span>
            </span>
            {i < labels.length - 1 && <span aria-hidden className="h-px w-3 sm:w-4 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}
