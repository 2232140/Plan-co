"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Wallet, MessageCircle, Lightbulb, Shuffle } from "lucide-react";
import { motion } from "framer-motion";
import ResultModal from "@/components/result-modal";
import { Suggestion } from "@/types/planco";
import { saveHistory } from "@/lib/history";

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  { id: "1", name: "カラオケ",      budget: "約1,500円", description: "みんなで盛り上がれる定番エンタメ",        reason: "人数が多くても楽しめる！" },
  { id: "2", name: "おしゃれカフェ", budget: "約800円",  description: "インテリアが映えるトレンドカフェ",        reason: "ゆったりおしゃべりにぴったり" },
  { id: "3", name: "公園でボート",   budget: "約600円",  description: "手漕ぎボートで水面を散策",               reason: "アクティブで思い出に残る！" },
  { id: "4", name: "映画館",        budget: "約1,800円", description: "最新作を大画面・迫力サウンドで",          reason: "天気に関係なく楽しめる" },
  { id: "5", name: "猫カフェ",      budget: "約1,200円", description: "かわいい猫たちに癒されるひととき",        reason: "ほっこり癒し系で大人気" },
];

const CARD_COLORS = ["#FFB5A7", "#B5EAD7", "#C7CEEA", "#FEC89A", "#FFDDE1"];

export default function SuggestionsPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>(FALLBACK_SUGGESTIONS);
  const [location, setLocation] = useState("どこでも");
  const [selected, setSelected] = useState<Suggestion | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("planco_suggestions");
      const storedLocation = sessionStorage.getItem("planco_location");
      if (stored) {
        const data = JSON.parse(stored) as Suggestion[];
        if (Array.isArray(data) && data.length > 0) setSuggestions(data);
      }
      if (storedLocation) setLocation(storedLocation);
    } catch {
      // fallback維持
    }
  }, []);

  return (
    <>
      <ResultModal
        suggestion={selected}
        location={location}
        onClose={() => setSelected(null)}
        onReSpin={() => {
          setSelected(null);
          router.push("/roulette");
        }}
        onDecide={() => {
          if (!selected) return;
          saveHistory({
            type: "ai",
            conditions: { location },
            options: suggestions.map((s) => s.name),
            selected_option: selected.name,
          });
        }}
        reSpinLabel="ルーレットで決める"
      />

      <main
        className="min-h-screen pb-32"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
      >
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header */}
          <header className="flex items-center mb-6">
            <button
              onClick={() => router.push("/")}
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

          {/* Section title */}
          <div className="mb-5">
            <h2 className="text-white font-extrabold text-xl drop-shadow-sm">
              AIが提案したプラン ✨
            </h2>
            <p className="text-white/80 text-sm mt-1">
              気に入ったものを選ぶか、ルーレットで決めよう！
            </p>
          </div>

          {/* Suggestion cards */}
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => setSelected(s)}
                className="w-full text-left bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-lg active:scale-[0.98] transition-transform"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-extrabold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                    >
                      {i + 1}
                    </div>
                    <span className="font-extrabold text-gray-800 text-lg leading-tight break-words min-w-0">{s.name}</span>
                  </div>
                  <span
                    className="text-xs font-bold px-3 py-1.5 rounded-full text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                  >
                    {s.budget}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 pl-1">
                  <div className="flex items-start gap-2">
                    <MessageCircle size={14} className="text-purple-400 shrink-0 mt-0.5" />
                    <p className="text-gray-600 text-sm leading-relaxed">{s.description}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lightbulb size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-gray-500 text-xs leading-relaxed">{s.reason}</p>
                  </div>
                </div>

                {/* Tap hint */}
                <div className="mt-3 flex items-center justify-end gap-1">
                  <MapPin size={13} className="text-orange-300" />
                  <span className="text-xs text-orange-300 font-bold">タップして詳細・決定</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 max-w-md mx-auto">
          <div className="bg-white/20 backdrop-blur-md rounded-3xl p-2">
            <button
              onClick={() => router.push("/roulette")}
              className="w-full py-4 rounded-2xl font-extrabold text-white text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
            >
              <Shuffle size={20} />
              やっぱり決められない…ルーレット・あみだくじで決める！
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
