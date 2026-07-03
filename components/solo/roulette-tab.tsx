"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import RouletteWheel from "@/components/roulette-wheel";
import AmidaKuji from "@/components/amida-kuji";
import ResultModal from "@/components/result-modal";
import { Suggestion } from "@/types/planco";

const CONFETTI_EMOJIS = ["🎉", "✨", "🎊", "⭐", "🌟", "💫"];

function ConfettiParticles({ show }: { show: boolean }) {
  if (!show) return null;
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i, emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
    x: 10 + Math.round(i * 7.5), delay: (i % 4) * 0.15,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <span key={p.id} className="absolute text-2xl animate-float-up"
          style={{ left: `${p.x}%`, bottom: "30%", animationDelay: `${p.delay}s` }}>{p.emoji}</span>
      ))}
    </div>
  );
}

export default function RouletteTab() {
  const [items, setItems]           = useState<string[]>(["", ""]);
  const [mode, setMode]             = useState<"roulette" | "amida">("roulette");
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selected, setSelected]     = useState<Suggestion | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [amidaKey, setAmidaKey]     = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filledItems = items.map((v) => v.trim()).filter(Boolean);
  const wheelItems  = filledItems;

  const updateItem  = (i: number, v: string) => setItems((p) => p.map((x, idx) => idx === i ? v : x));
  const addItem     = () => { if (items.length < 10) setItems((p) => [...p, ""]); };
  const removeItem  = (i: number) => { if (items.length > 2) setItems((p) => p.filter((_, idx) => idx !== i)); };

  const handleSpin = () => {
    if (isSpinning) return;
    if (filledItems.length < 2) { setError("2つ以上の選択肢を入力してください"); return; }
    setError(null);
    setSelected(null);
    setShowConfetti(false);
    setIsSpinning(true);
    setSpinTrigger((t) => t + 1);
  };

  const handleComplete = useCallback((name: string) => {
    setSelected({ id: "1", name, budget: "", description: "", reason: "" });
    setIsSpinning(false);
    setShowConfetti(true);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), 2200);
  }, []);

  const handleAmidaComplete = useCallback((name: string) => {
    setSelected({ id: "1", name, budget: "", description: "", reason: "" });
    setShowConfetti(true);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), 2200);
  }, []);

  const handleReSpin = () => {
    setSelected(null);
    setShowConfetti(false);
    if (mode === "roulette") handleSpin();
    else setAmidaKey((k) => k + 1);
  };

  return (
    <>
      <ResultModal
        suggestion={selected}
        location=""
        onClose={() => setSelected(null)}
        onReSpin={handleReSpin}
        reSpinLabel={mode === "amida" ? "もう一度あみだくじをする" : undefined}
        hideMap={true}
      />

      <div className="px-4 py-5 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-100 text-red-600 rounded-2xl px-4 py-3 text-sm font-bold">
            <AlertCircle size={16} className="shrink-0" />{error}
          </div>
        )}

        {/* Item inputs */}
        <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-5 shadow-xl">
          <p className="font-extrabold text-gray-700 text-sm mb-3">選択肢を入力（2〜10個）</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-400 font-extrabold text-sm shrink-0">{i + 1}</div>
                <input type="text" value={item} onChange={(e) => updateItem(i, e.target.value)}
                  placeholder={`選択肢 ${i + 1}`} maxLength={10}
                  className="flex-1 px-3 py-2 rounded-2xl border-2 border-orange-100 bg-orange-50 text-gray-700 font-bold placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:border-orange-300 text-sm" />
                {items.length > 2 && (
                  <button onClick={() => removeItem(i)}
                    className="p-1.5 rounded-full bg-red-50 text-red-300 hover:bg-red-100 hover:text-red-400 transition-colors active:scale-95">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {items.length < 10 && (
            <button onClick={addItem}
              className="w-full mt-2 py-2 rounded-2xl border-2 border-dashed border-orange-200 text-orange-300 font-bold text-sm hover:border-orange-300 hover:text-orange-400 transition-colors flex items-center justify-center gap-2 active:scale-95">
              <Plus size={15} />追加（最大10個）
            </button>
          )}
        </div>

        {/* Mode toggle */}
        <div className="bg-white/25 rounded-2xl p-1 flex">
          <button onClick={() => setMode("roulette")}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${mode === "roulette" ? "bg-white text-orange-400 shadow-md" : "text-white/80"}`}>
            🎡 ルーレット
          </button>
          <button onClick={() => { setSpinTrigger(0); setMode("amida"); }}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${mode === "amida" ? "bg-white text-orange-400 shadow-md" : "text-white/80"}`}>
            🪜 あみだくじ
          </button>
        </div>

        {/* Wheel / Amida */}
        <AnimatePresence mode="wait">
          {mode === "roulette" ? (
            <motion.div key="roulette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="relative bg-white/85 backdrop-blur-sm rounded-3xl p-5 shadow-2xl flex flex-col items-center overflow-hidden">
                <ConfettiParticles show={showConfetti} />
                {filledItems.length >= 2 ? (
                  <RouletteWheel items={wheelItems} spinTrigger={spinTrigger} onComplete={handleComplete} />
                ) : (
                  <div className="py-10 text-gray-400 text-sm font-bold text-center">
                    選択肢を2つ以上入力すると<br />ルーレットが表示されます
                  </div>
                )}
                {selected && !isSpinning && (
                  <div className="mt-4 text-center animate-pop-in">
                    <p className="text-xs text-gray-400 font-bold tracking-widest">決まりました！</p>
                    <p className="text-2xl font-extrabold text-orange-500 mt-1">{selected.name} 🎉</p>
                  </div>
                )}
              </div>
              <button onClick={handleSpin} disabled={isSpinning || filledItems.length < 2}
                className={`w-full mt-3 py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isSpinning ? "opacity-70 cursor-not-allowed" : "active:scale-95"}`}
                style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
                {isSpinning ? "🌀 回転中..." : selected ? "🔄 もう一度回す" : "🎡 START"}
              </button>
            </motion.div>
          ) : (
            <motion.div key="amida" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="relative bg-white/85 backdrop-blur-sm rounded-3xl px-4 py-5 shadow-2xl flex flex-col items-center overflow-hidden">
                <ConfettiParticles show={showConfetti} />
                {filledItems.length >= 2 ? (
                  <AmidaKuji key={amidaKey} items={wheelItems} onComplete={handleAmidaComplete} />
                ) : (
                  <div className="py-10 text-gray-400 text-sm font-bold text-center">
                    選択肢を2つ以上入力すると<br />あみだくじが表示されます
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
