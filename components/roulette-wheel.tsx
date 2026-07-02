"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { motion } from "framer-motion";

interface RouletteWheelProps {
  items: string[];
  spinTrigger: number;
  onComplete: (item: string) => void;
  syncedTarget?: number; // room sync: use this rotation instead of random
}

const SECTOR_COLORS = [
  "#FFB5A7",
  "#B5EAD7",
  "#C7CEEA",
  "#FEC89A",
  "#FFDDE1",
  "#D4F1C0",
];

export default function RouletteWheel({ items, spinTrigger, onComplete, syncedTarget }: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRotationRef = useRef(0);
  const syncedTargetRef = useRef<number | undefined>(undefined);
  const [targetRotation, setTargetRotation] = useState(0);
  const N = items.length;
  const SECTOR_ANGLE = 360 / N;

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    // outer shadow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fill();

    // white border ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();

    for (let i = 0; i < N; i++) {
      const startAngle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const endAngle = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / N;
      const midAngle = (startAngle + endAngle) / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SECTOR_COLORS[i % SECTOR_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.stroke();

      // label text
      const textR = r * 0.62;
      ctx.save();
      ctx.translate(
        cx + textR * Math.cos(midAngle),
        cy + textR * Math.sin(midAngle)
      );
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = "#555";
      ctx.font = `bold ${Math.max(11, Math.floor(size / 20))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(items[i], 0, 0);
      ctx.restore();
    }

    // center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#FFB5A7";
    ctx.fill();
  }, [N, items]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // keep ref in sync so the spinTrigger effect reads the latest value
  syncedTargetRef.current = syncedTarget;

  // trigger a new spin when spinTrigger increments
  useEffect(() => {
    if (spinTrigger === 0) return;
    if (syncedTargetRef.current !== undefined) {
      // room sync mode: animate to the shared target
      setTargetRotation(syncedTargetRef.current);
    } else {
      // local mode: generate random rotation
      const extra = Math.random() * 360;
      const newTarget = baseRotationRef.current + 360 * 7 + extra;
      baseRotationRef.current = newTarget;
      setTargetRotation(newTarget);
    }
  }, [spinTrigger]);

  const handleAnimationComplete = useCallback(() => {
    if (targetRotation === 0) return;
    // ホイールがR度時計回りに回ると、ポインターには元々(360-R)度の位置にいたセクターが来る
    const normalized = (360 - (targetRotation % 360)) % 360;
    const winnerIdx = Math.floor(normalized / SECTOR_ANGLE) % N;
    onComplete(items[winnerIdx]);
  }, [targetRotation, SECTOR_ANGLE, N, items, onComplete]);

  return (
    <div className="flex flex-col items-center select-none">
      {/* Fixed pointer at top */}
      <div className="z-10" style={{ marginBottom: "-14px" }}>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "28px solid #FF6B6B",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
          }}
        />
      </div>

      {/* Spinning wheel */}
      <motion.div
        animate={{ rotate: targetRotation }}
        transition={{ duration: 4.5, ease: [0.2, 0.85, 0.3, 1.0] }}
        onAnimationComplete={handleAnimationComplete}
      >
        <canvas ref={canvasRef} width={280} height={280} className="rounded-full" />
      </motion.div>

      <p className="text-xs text-gray-400 mt-3">タップして回す</p>
    </div>
  );
}
