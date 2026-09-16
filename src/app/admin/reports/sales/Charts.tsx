"use client";

import { useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const compact = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(1)}M`
  : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000 ? `${Math.round(n / 1_000)}rb`
  : String(Math.round(n));

const INK = "#0d2137";
const MUTED = "#6e7a74";
const GRID = "#e4e2e1";

// ── Revenue by stream ────────────────────────────────────────────────────────
// Horizontal bars: the job is comparing magnitude across a few named
// categories, and horizontal keeps the labels readable without rotation.

export function StreamBars({ data }: {
  data: { label: string; amount: number; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = data.filter((d) => d.amount > 0);

  if (rows.length === 0) {
    return (
      <div className="text-sm text-[#6e7a74] py-8 text-center border border-dashed border-[#cccccc] rounded-lg">
        Belum ada pendapatan pada periode ini.
      </div>
    );
  }

  const max = Math.max(...rows.map((d) => d.amount));
  const barH = 30, gap = 12, labelW = 150, valueW = 92;
  const chartW = 640, plotW = chartW - labelW - valueW;
  const height = rows.length * (barH + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={chartW} height={height} role="img"
           aria-label="Pendapatan per sumber" style={{ minWidth: chartW }}>
        {rows.map((d, i) => {
          const y = i * (barH + gap);
          const w = max > 0 ? (d.amount / max) * plotW : 0;
          const isHover = hover === i;
          return (
            <g key={d.label}
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit target larger than the mark */}
              <rect x={0} y={y - gap / 2} width={chartW} height={barH + gap} fill="transparent" />
              <text x={labelW - 12} y={y + barH / 2} textAnchor="end" dominantBaseline="middle"
                    fontSize="12.5" fill={INK}>{d.label}</text>
              <rect x={labelW} y={y} width={Math.max(w, 2)} height={barH}
                    rx={4} fill={d.color} opacity={hover === null || isHover ? 1 : 0.45} />
              <text x={labelW + Math.max(w, 2) + 10} y={y + barH / 2}
                    dominantBaseline="middle" fontSize="12.5"
                    fill={INK} fontWeight={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                {compact(d.amount)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && rows[hover] && (
        <p className="text-xs text-[#3e4944] mt-2">
          <span className="font-semibold">{rows[hover].label}</span>
          {" — IDR "}{fmt(rows[hover].amount)}
        </p>
      )}
    </div>
  );
}

// ── 12-month trend ───────────────────────────────────────────────────────────
// One line per stream. Single y-axis: every series is IDR, so they share a
// scale and a second axis would only invite false comparisons.

export function TrendLines({ months, series }: {
  months: string[];
  series: { label: string; color: string; values: number[] }[];
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const live = series.filter((s) => s.values.some((v) => v > 0));
  if (live.length === 0) {
    return (
      <div className="text-sm text-[#6e7a74] py-10 text-center border border-dashed border-[#cccccc] rounded-lg">
        Belum ada pendapatan tercatat dalam 12 bulan terakhir.
      </div>
    );
  }

  const W = 720, H = 240, padL = 56, padR = 16, padT = 16, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(1, ...live.flatMap((s) => s.values));
  const x = (i: number) => padL + (months.length <= 1 ? 0 : (i / (months.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const ticks = [0, 0.5, 1].map((t) => max * t);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img" aria-label="Tren pendapatan 12 bulan"
           style={{ minWidth: W }}
           onMouseLeave={() => setHoverX(null)}
           onMouseMove={(e) => {
             const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
             const px = e.clientX - rect.left - padL;
             const i = Math.round((px / plotW) * (months.length - 1));
             setHoverX(i >= 0 && i < months.length ? i : null);
           }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle"
                  fontSize="10.5" fill={MUTED}
                  style={{ fontVariantNumeric: "tabular-nums" }}>{compact(t)}</text>
          </g>
        ))}

        {months.map((m, i) =>
          i % 2 === 0 ? (
            <text key={m} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill={MUTED}>
              {m.slice(5)}/{m.slice(2, 4)}
            </text>
          ) : null
        )}

        {hoverX !== null && (
          <line x1={x(hoverX)} x2={x(hoverX)} y1={padT} y2={padT + plotH}
                stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
        )}

        {live.map((s) => (
          <g key={s.label}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />
            {hoverX !== null && (
              <circle cx={x(hoverX)} cy={y(s.values[hoverX] ?? 0)} r={4.5}
                      fill={s.color} stroke="#fff" strokeWidth={2} />
            )}
          </g>
        ))}
      </svg>

      {hoverX !== null && (
        <div className="text-xs text-[#3e4944] mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-semibold">{months[hoverX]}</span>
          {live.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.color }} />
              {s.label}: IDR {fmt(s.values[hoverX] ?? 0)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#3e4944]">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
