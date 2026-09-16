// Reporting periods. Every figure on a report respects the selection, and each
// period carries the equivalent preceding window so "change vs last period"
// compares like with like.

export type PeriodKey = "this_month" | "last_month" | "last_3_months" | "ytd" | "custom";

export interface Period {
  key: PeriodKey;
  label: string;
  /** Inclusive start. */
  from: Date;
  /** Exclusive end — avoids the off-by-one that inclusive end dates invite. */
  to: Date;
  /** Same-length window immediately before `from`. */
  prevFrom: Date;
  prevTo: Date;
}

const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "this_month",    label: "Bulan ini" },
  { key: "last_month",    label: "Bulan lalu" },
  { key: "last_3_months", label: "3 bulan terakhir" },
  { key: "ytd",           label: "Tahun berjalan" },
  { key: "custom",        label: "Rentang khusus" },
];

export function resolvePeriod(key?: string, from?: string, to?: string): Period {
  const now = new Date();
  const thisMonth = startOfMonth(now);

  let start: Date;
  let end: Date;
  let label: string;
  let resolved = (key ?? "this_month") as PeriodKey;

  switch (resolved) {
    case "last_month":
      start = addMonths(thisMonth, -1); end = thisMonth; label = "Bulan lalu"; break;
    case "last_3_months":
      start = addMonths(thisMonth, -2); end = addMonths(thisMonth, 1); label = "3 bulan terakhir"; break;
    case "ytd":
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      end = addMonths(thisMonth, 1); label = "Tahun berjalan"; break;
    case "custom": {
      const f = from ? new Date(`${from}T00:00:00Z`) : null;
      const t = to ? new Date(`${to}T00:00:00Z`) : null;
      if (f && t && !isNaN(+f) && !isNaN(+t) && f < t) {
        start = f;
        end = new Date(t.getTime() + 86_400_000); // make the end date inclusive to the reader
        label = `${from} – ${to}`;
        break;
      }
      // Incomplete or nonsensical custom range falls back rather than showing nothing.
      resolved = "this_month";
      start = thisMonth; end = addMonths(thisMonth, 1); label = "Bulan ini";
      break;
    }
    case "this_month":
    default:
      resolved = "this_month";
      start = thisMonth; end = addMonths(thisMonth, 1); label = "Bulan ini";
  }

  const span = end.getTime() - start.getTime();
  return {
    key: resolved, label, from: start, to: end,
    prevFrom: new Date(start.getTime() - span),
    prevTo: start,
  };
}
