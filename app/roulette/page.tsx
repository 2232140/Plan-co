"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import RouletteWheel from "@/components/roulette-wheel";
import ResultModal from "@/components/result-modal";
import { Suggestion } from "@/types/planco";
import { saveHistory } from "@/lib/history";

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  { id: "1", name: "カラオケ",     budget: "約1,500円", description: "みんなで盛り上がれる定番エンタメ",        reason: "人数が多くても楽しめる！" },
  { id: "2", name: "おしゃれカフェ", budget: "約800円",  description: "インテリアが映えるトレンドカフェ",       reason: "ゆったりおしゃべりにぴったり" },
  { id: "3", name: "公園でボート",  budget: "約600円",  description: "手漕ぎボートで水面を散策",               reason: "アクティブで思い出に残る！" },
  { id: "4", name: "映画館",       budget: "約1,800円", description: "最新作を大画面・迫力サウンドで",          reason: "天気に関係なく楽しめる" },
  { id: "5", name: "猫カフェ",     budget: "約1,200円", description: "かわいい猫たちに癒されるひととき",        reason: "ほっこり癒し系で大人気" },
];

const CONFETTI_EMOJIS = ["🎉", "✨", "🎊", "⭐", "🌟", "💫"];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

function ConfettiParticles({ show }: { show: boolean }) {
  if (!show) return null;
  const particles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
    x: 10 + Math.round(i * 7.5),
    delay: (i % 4) * 0.15,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-2xl animate-float-up"
          style={{ left: `${p.x}%`, bottom: "30%", animationDelay: `${p.delay}s` }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

export default function RoulettePage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>(FALLBACK_SUGGESTIONS);
  const [location, setLocation] = useState("どこでも");
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeTab, setActiveTab] = useState<"roulette" | "amida">("roulette");
  const [isCustom, setIsCustom] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sessionStorageからAIの提案データを読み込む
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("planco_suggestions");
      const storedLocation = sessionStorage.getItem("planco_location");
      if (stored) {
        const data = JSON.parse(stored) as Suggestion[];
        if (Array.isArray(data) && data.length > 0) setSuggestions(data);
      }
      if (storedLocation) setLocation(storedLocation);
      if (sessionStorage.getItem("planco_custom") === "true") setIsCustom(true);
    } catch {
      // fallback維持
    }
  }, []);

  const wheelItems = suggestions.map((s) => s.name);

  const handleSpin = () => {
    if (isSpinning) return;
    setSelectedSuggestion(null);
    setShowConfetti(false);
    setIsSpinning(true);
    setSpinTrigger((t) => t + 1);
  };

  const handleComplete = useCallback(
    (name: string) => {
      const found = suggestions.find((s) => s.name === name) ?? null;
      setSelectedSuggestion(found);
      setIsSpinning(false);
      setShowConfetti(true);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 2200);
    },
    [suggestions]
  );

  const handleDecide = () => {
    if (!selectedSuggestion) return;
    saveHistory({
      type: isCustom ? "custom" : "ai",
      conditions: isCustom ? {} : { location },
      options: suggestions.map((s) => s.name),
      selected_option: selectedSuggestion.name,
    });
  };

  const handleReSpin = () => {
    setSelectedSuggestion(null);
    setShowConfetti(false);
    handleSpin();
  };

  return (
    <>
      <ResultModal
        suggestion={selectedSuggestion}
        location={location}
        onClose={() => setSelectedSuggestion(null)}
        onReSpin={handleReSpin}
        onDecide={handleDecide}
      />

      <main
        className="min-h-screen"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
      >
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header */}
          <header className="flex items-center mb-6">
            <button
              onClick={() => router.push("/suggestions")}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex-1 text-center pr-9">
              <h1 className="text-2xl font-extrabold text-white drop-shadow-md">Plan-co 🎢</h1>
              {location !== "どこでも" && (
                <p className="text-white/80 text-xs font-bold mt-0.5">📍 {location}</p>
              )}
            </div>
          </header>

          {/* Tabs */}
          <div className="bg-white/25 rounded-2xl p-1 flex mb-6">
            <button
              onClick={() => setActiveTab("roulette")}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
                activeTab === "roulette"
                  ? "bg-white text-orange-400 shadow-md"
                  : "text-white/80 hover:text-white"
              }`}
            >
              🎡 ルーレット
            </button>
            <button
              onClick={() => setActiveTab("amida")}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
                activeTab === "amida"
                  ? "bg-white text-orange-400 shadow-md"
                  : "text-white/80 hover:text-white"
              }`}
            >
              🪜 あみだくじ
            </button>
          </div>

          {activeTab === "roulette" ? (
            <div className="space-y-5">
              {/* Wheel card */}
              <div className="relative bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center overflow-hidden">
                <ConfettiParticles show={showConfetti} />
                <RouletteWheel
                  items={wheelItems}
                  spinTrigger={spinTrigger}
                  onComplete={handleComplete}
                />
                {selectedSuggestion && !isSpinning && (
                  <div className="mt-5 text-center animate-pop-in">
                    <p className="text-xs text-gray-400 font-bold tracking-widest">決まりました！</p>
                    <p className="text-3xl font-extrabold text-orange-500 mt-1">
                      {selectedSuggestion.name} 🎉
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleSpin}
                  disabled={isSpinning}
                  className={`w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isSpinning ? "opacity-70 cursor-not-allowed" : "active:scale-95"
                  }`}
                  style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
                >
                  {isSpinning ? "🌀 回転中..." : selectedSuggestion ? "🔄 もう一度回す" : "🎡 START"}
                </button>

                {selectedSuggestion && !isSpinning && (
                  <button
                    onClick={() => setSelectedSuggestion(selectedSuggestion)}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-500"
                  >
                    詳細を見る・ここに決定！
                  </button>
                )}
                <button
                  onClick={() => router.push("/room/new")}
                  className="w-full py-3 rounded-2xl font-bold text-blue-400 bg-blue-50 hover:bg-blue-100 transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  <Users size={15} />
                  友達と一緒に回す
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-3">
              <span className="text-5xl">🪜</span>
              <p className="font-extrabold text-gray-600 text-xl">あみだくじ</p>
              <p className="text-gray-400 text-sm text-center leading-relaxed">
                近日公開予定！<br />スプリント3でお楽しみに✨
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
