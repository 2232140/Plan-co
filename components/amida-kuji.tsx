"use client";

import { useState, useEffect, useRef } from "react";

const ICONS = ["🐱", "🐶", "🐻", "🐼", "🐰", "🦊", "🐸", "🐯"];
const ROWS = 8;
const ROW_H = 36;
const HEADER_H = 72;
const FOOTER_H = 64;
const SVG_W = 300;
const SVG_H = HEADER_H + ROWS * ROW_H + FOOTER_H; // 424

type Bridge = { col: number; row: number };

function buildBridges(n: number): Bridge[] {
  const out: Bridge[] = [];
  for (let row = 0; row < ROWS; row++) {
    const used = new Set<number>();
    for (let col = 0; col < n - 1; col++) {
      if (used.has(col)) continue;
      if (Math.random() < 0.42) {
        out.push({ col, row });
        used.add(col);
        used.add(col + 1);
      }
    }
  }
  return out;
}

function tracePath(start: number, bridges: Bridge[]): number[] {
  const path = [start];
  let col = start;
  for (let row = 0; row < ROWS; row++) {
    if (bridges.some((b) => b.row === row && b.col === col)) col++;
    else if (bridges.some((b) => b.row === row && b.col === col - 1)) col--;
    path.push(col);
  }
  return path; // length = ROWS + 1
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  items: string[];
  onComplete: (item: string) => void;
}

export default function AmidaKuji({ items, onComplete }: Props) {
  const n = Math.max(2, Math.min(items.length, ICONS.length));
  const labels = items.slice(0, n);
  const span = SVG_W - 48; // 24px padding on each side
  const gap = n > 1 ? span / (n - 1) : span;
  const iconR = Math.min(20, Math.floor(gap * 0.38));
  const colX = (i: number) => 24 + i * gap;
  const rowY = (r: number) => HEADER_H + r * ROW_H;

  const [bridges] = useState<Bridge[]>(() => buildBridges(n));
  const [results] = useState<string[]>(() => shuffled(labels));
  const [phase, setPhase] = useState<"idle" | "reveal" | "trace" | "done">("idle");
  const [selCol, setSelCol] = useState<number | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pick = (col: number) => {
    if (phase !== "idle") return;
    const p = tracePath(col, bridges);
    setSelCol(col);
    setPath(p);
    setStep(0);
    setPhase("reveal");
    timerRef.current = setTimeout(() => setPhase("trace"), 650);
  };

  useEffect(() => {
    if (phase !== "trace") return;
    if (step >= ROWS) {
      setPhase("done");
      timerRef.current = setTimeout(() => onComplete(results[path[ROWS]]), 500);
      return;
    }
    timerRef.current = setTimeout(() => setStep((s) => s + 1), 185);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build path segments already traced
  const pathLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < step && i < path.length - 1; i++) {
    const fc = path[i], tc = path[i + 1];
    const fx = colX(fc), tx = colX(tc);
    const fy = rowY(i), ty = rowY(i + 1), my = (fy + ty) / 2;
    if (fc === tc) {
      pathLines.push({ x1: fx, y1: fy, x2: fx, y2: ty });
    } else {
      pathLines.push({ x1: fx, y1: fy, x2: fx, y2: my });
      pathLines.push({ x1: fx, y1: my, x2: tx, y2: my });
      pathLines.push({ x1: tx, y1: my, x2: tx, y2: ty });
    }
  }

  const dotStep = Math.min(step, ROWS);
  const winCol = phase === "done" && path.length > 0 ? path[ROWS] : null;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <p className="text-white/80 text-xs font-bold h-5 text-center">
        {phase === "idle" && "キャラクターをタップして選ぼう 👇"}
        {(phase === "reveal" || phase === "trace") && "🪜 辿っています…"}
        {phase === "done" && `🎉 ${results[path[ROWS]]} に決定！`}
      </p>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ maxWidth: 340, touchAction: "manipulation" }}
      >
        {/* Vertical lines */}
        {Array.from({ length: n }, (_, i) => (
          <line
            key={i}
            x1={colX(i)} y1={rowY(0)}
            x2={colX(i)} y2={rowY(ROWS)}
            stroke="#e5e7eb" strokeWidth={2.5} strokeLinecap="round"
          />
        ))}

        {/* Horizontal bridges — hidden until reveal */}
        {bridges.map((b, i) => (
          <line
            key={i}
            x1={colX(b.col)}     y1={rowY(b.row) + ROW_H / 2}
            x2={colX(b.col + 1)} y2={rowY(b.row) + ROW_H / 2}
            stroke="#d1d5db" strokeWidth={2.5} strokeLinecap="round"
            opacity={phase === "idle" ? 0 : 1}
            style={{ transition: `opacity 0.22s ease ${(i * 0.028).toFixed(3)}s` }}
          />
        ))}

        {/* Traced path (orange) */}
        {pathLines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#fb923c" strokeWidth={4} strokeLinecap="round"
          />
        ))}

        {/* Moving dot */}
        {(phase === "trace" || phase === "done") && path.length > 0 && (
          <circle
            cx={colX(path[dotStep])} cy={rowY(dotStep)}
            r={8} fill="#fb923c" stroke="white" strokeWidth={2.5}
          />
        )}

        {/* Top icons (tappable in idle) */}
        {Array.from({ length: n }, (_, i) => (
          <g
            key={i}
            onClick={() => pick(i)}
            style={{ cursor: phase === "idle" ? "pointer" : "default" }}
          >
            <circle
              cx={colX(i)} cy={HEADER_H / 2} r={iconR}
              fill={selCol === i ? "#fb923c" : "white"}
              stroke={selCol === i ? "#fb923c" : "#e5e7eb"} strokeWidth={2}
              style={{ transition: "fill 0.2s, stroke 0.2s" }}
            />
            <text
              x={colX(i)} y={HEADER_H / 2 + Math.floor(iconR * 0.38)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.floor(iconR * 1.1)}
            >
              {ICONS[i]}
            </text>
          </g>
        ))}

        {/* Bottom result boxes */}
        {results.map((label, i) => {
          const cx = colX(i);
          const bw = Math.min(54, gap * 0.88);
          const bh = FOOTER_H - 14;
          const isWin = winCol === i;
          const display = label.length > 5 ? label.slice(0, 4) + "…" : label;
          return (
            <g key={i}>
              <rect
                x={cx - bw / 2} y={rowY(ROWS) + 6}
                width={bw} height={bh} rx={7}
                fill={isWin ? "#fb923c" : "white"}
                stroke={isWin ? "#fb923c" : "#e5e7eb"} strokeWidth={1.5}
                style={{ transition: "fill 0.4s, stroke 0.4s" }}
              />
              <text
                x={cx} y={rowY(ROWS) + 6 + bh / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={8.5} fontWeight="bold"
                fill={isWin ? "white" : "#6b7280"}
                style={{ transition: "fill 0.4s" }}
              >
                {display}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
