"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import LocationTab from "@/components/solo/location-tab";
import DayPlanTab  from "@/components/solo/day-plan-tab";
import AIChatTab   from "@/components/solo/ai-chat-tab";
import RouletteTab from "@/components/solo/roulette-tab";

const TABS = [
  { label: "場所探す",  emoji: "📍" },
  { label: "1日プラン", emoji: "📅" },
  { label: "AIチャット", emoji: "💬" },
  { label: "ルーレット", emoji: "🎡" },
];

export default function SoloPage() {
  const router  = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [prevTab,   setPrevTab]   = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goTo = (next: number) => {
    setPrevTab(activeTab);
    setActiveTab(next);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe horizontally (dx dominates dy)
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goTo(Math.min(activeTab + 1, TABS.length - 1));
    else        goTo(Math.max(activeTab - 1, 0));
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-20 pt-5 pb-3 px-4"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center mb-3">
            <button onClick={() => router.push("/")}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="flex-1 text-center text-xl font-extrabold text-white drop-shadow-md">
              Plan-co 🎢
            </h1>
            <button onClick={() => router.push("/history")}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95">
              <History size={20} className="text-white" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="bg-white/25 rounded-2xl p-1 flex gap-0.5">
            {TABS.map((tab, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex flex-col items-center gap-0.5 ${
                  activeTab === i ? "bg-white text-orange-400 shadow-md" : "text-white/80 hover:text-white"}`}>
                <span className="text-base leading-none">{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content — all 4 tabs stay mounted, only active one is visible */}
      <div className="max-w-md mx-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        <div className={activeTab === 0 ? "block" : "hidden"}><LocationTab /></div>
        <div className={activeTab === 1 ? "block" : "hidden"}><DayPlanTab /></div>
        <div className={activeTab === 2 ? "block" : "hidden"}><AIChatTab /></div>
        <div className={activeTab === 3 ? "block" : "hidden"}><RouletteTab /></div>
      </div>
    </div>
  );
}
