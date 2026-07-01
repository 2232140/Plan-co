"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Wallet, Sparkles, Settings, MapPin, AlertCircle } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import { Suggestion } from "@/types/planco";

const PEOPLE_OPTIONS = [
  { value: "1人", label: "1人" },
  { value: "2人", label: "2人" },
  { value: "3〜4人", label: "3〜4人" },
  { value: "5人以上", label: "5人以上" },
];

const BUDGET_OPTIONS = [
  { value: "〜1,000円", label: "〜1,000円" },
  { value: "〜3,000円", label: "〜3,000円" },
  { value: "〜5,000円", label: "〜5,000円" },
  { value: "〜10,000円", label: "〜10,000円" },
  { value: "上限なし", label: "上限なし" },
];

const THEME_OPTIONS = [
  { value: "グルメ", emoji: "🍔", label: "グルメ" },
  { value: "まったりカフェ", emoji: "☕", label: "まったりカフェ" },
  { value: "アクティブ", emoji: "🏃", label: "アクティブ" },
  { value: "アート・文化", emoji: "🎨", label: "アート・文化" },
  { value: "屋内でゆっくり", emoji: "🏠", label: "屋内でゆっくり" },
  { value: "ショッピング", emoji: "🛍️", label: "ショッピング" },
];

const QUICK_AREAS = ["渋谷", "新宿", "梅田", "難波", "名古屋", "横浜", "札幌", "博多"];

export default function HomePage() {
  const router = useRouter();
  const [people, setPeople] = useState("2人");
  const [budget, setBudget] = useState("〜3,000円");
  const [themes, setThemes] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTheme = (value: string) => {
    setThemes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peopleCount: people,
          budget,
          theme: themes.length > 0 ? themes.join("・") : "なんでも",
          location: location.trim() || "どこでも",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "提案の取得に失敗しました");
      }

      const data = await res.json() as { suggestions: Suggestion[] };
      sessionStorage.setItem("planco_suggestions", JSON.stringify(data.suggestions));
      sessionStorage.setItem("planco_location", location.trim() || "どこでも");

      router.push("/suggestions");
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <>
      {isLoading && <LoadingScreen />}

      <main
        className="min-h-screen"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
      >
        <div className="max-w-md mx-auto px-4 py-10">
          {/* Header */}
          <header className="text-center mb-8">
            <h1 className="text-5xl font-extrabold text-white drop-shadow-md tracking-wide">
              Plan-co
            </h1>
            <p className="text-white/90 text-sm mt-2 font-bold tracking-widest">
              🎢 今日の遊び、一緒に決めよう！
            </p>
          </header>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 bg-red-100 text-red-600 rounded-2xl px-4 py-3 mb-4 text-sm font-bold">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Card */}
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl space-y-7">

            {/* Location */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={17} className="text-rose-400" />
                <span className="font-extrabold text-gray-700 text-sm">
                  どこで遊ぶ？
                  <span className="text-gray-400 font-medium ml-1">（任意）</span>
                </span>
              </div>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例：渋谷、新宿、梅田..."
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-rose-100 bg-rose-50 text-gray-700 font-bold placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:border-rose-300 text-sm transition-colors"
              />
              {/* Quick chips */}
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => setLocation(area)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
                      location === area
                        ? "bg-rose-400 text-white shadow-sm scale-105"
                        : "bg-rose-50 text-rose-400 hover:bg-rose-100 active:scale-95"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </section>

            {/* People */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users size={17} className="text-orange-400" />
                <span className="font-extrabold text-gray-700 text-sm">一緒に行く人数</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PEOPLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeople(opt.value)}
                    className={`py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                      people === opt.value
                        ? "bg-orange-400 text-white shadow-md scale-105"
                        : "bg-orange-50 text-orange-400 hover:bg-orange-100 active:scale-95"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Budget */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={17} className="text-yellow-500" />
                <span className="font-extrabold text-gray-700 text-sm">予算（1人あたり）</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BUDGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setBudget(opt.value)}
                    className={`py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                      budget === opt.value
                        ? "bg-yellow-400 text-white shadow-md scale-105"
                        : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100 active:scale-95"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Theme */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={17} className="text-purple-400" />
                <span className="font-extrabold text-gray-700 text-sm">
                  テーマ
                  <span className="text-gray-400 font-medium ml-1">（複数選択可）</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleTheme(opt.value)}
                    className={`flex flex-col items-center py-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                      themes.includes(opt.value)
                        ? "bg-purple-400 text-white shadow-md scale-105"
                        : "bg-purple-50 text-purple-600 hover:bg-purple-100 active:scale-95"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="mt-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Buttons */}
            <div className="space-y-3 pt-1">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
              >
                プランを決める！✨
              </button>
              <button className="w-full py-3 rounded-2xl font-bold text-gray-400 bg-gray-100 hover:bg-gray-200 transition-all text-sm flex items-center justify-center gap-2 active:scale-95">
                <Settings size={15} />
                自分でルーレットを作る
              </button>
            </div>
          </div>

          <p className="text-center text-white/60 text-xs mt-6">
            Plan-co — 楽しい予定はもっとスムーズに
          </p>
        </div>
      </main>
    </>
  );
}
