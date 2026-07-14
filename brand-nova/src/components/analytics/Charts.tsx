"use client";

import { useEffect, useRef, useState } from "react";

/** Ease a 0→1 progress value once on mount, for chart draw-in animations. */
function useDrawIn(durationMs = 900): number {
  const [t, setT] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [durationMs]);
  return t;
}

// ---------------------------------------------------------------------------
// Donut — a single rate (0–100%) as an animated ring with the value centered.
// ---------------------------------------------------------------------------
export function Donut({
  value,
  label,
  color = "#7c8cff",
  sub,
  size = 132,
}: {
  value: number;
  label: string;
  color?: string;
  sub?: string;
  size?: number;
}) {
  const t = useDrawIn();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c * t;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-ink">
            {(pct * t).toFixed(1)}%
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-ink-2">{label}</p>
      {sub && <p className="text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend — multi-series area/line chart over time (SVG).
// ---------------------------------------------------------------------------
export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: number[];
}

export function TrendChart({
  series,
  labels,
  height = 200,
}: {
  series: TrendSeries[];
  labels: string[];
  height?: number;
}) {
  const t = useDrawIn(1000);
  const w = 720;
  const padX = 8;
  const padY = 16;
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.points)
  );
  const n = labels.length;
  const x = (i: number) => padX + (i * (w - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => padY + (1 - v / max) * (height - padY * 2);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={w - padX}
            y1={padY + g * (height - padY * 2)}
            y2={padY + g * (height - padY * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}
        {series.map((s) => {
          const pts = s.points.map((v, i) => `${x(i)},${y(v)}`);
          const line = pts.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
          const area = `${line} L${x(n - 1)},${height - padY} L${x(0)},${height - padY} Z`;
          return (
            <g key={s.key} style={{ opacity: t }}>
              <path d={area} fill={s.color} fillOpacity={0.08} />
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: 2000 * (1 - t),
                }}
              />
              {s.points.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} opacity={t} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
              aria-hidden
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel — sent → delivered → opened → clicked, each stage a shrinking bar.
// ---------------------------------------------------------------------------
export function Funnel({
  stages,
}: {
  stages: { label: string; value: number; color: string }[];
}) {
  const t = useDrawIn(900);
  const top = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const pctOfTop = (s.value / top) * 100;
        const pctOfPrev =
          i === 0 ? 100 : ((s.value / Math.max(1, stages[i - 1].value)) * 100);
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink-2">{s.label}</span>
              <span className="tabular-nums text-ink-3">
                {s.value.toLocaleString("nl-NL")}
                {i > 0 && (
                  <span className="ml-1.5 text-ink-3">· {pctOfPrev.toFixed(0)}%</span>
                )}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-lg bg-panel-2/60">
              <div
                className="flex h-full items-center rounded-lg px-3 text-xs font-medium text-void transition-[width] duration-700"
                style={{
                  width: `${Math.max(6, pctOfTop * t)}%`,
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}bb)`,
                  boxShadow: `0 0 18px ${s.color}44`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
