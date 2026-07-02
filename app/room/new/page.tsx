"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Suggestion } from "@/types/planco";

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function NewRoomPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [location, setLocation] = useState("どこでも");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedNickname = sessionStorage.getItem("planco_nickname");
    if (savedNickname) setNickname(savedNickname);

    try {
      const stored = sessionStorage.getItem("planco_suggestions");
      const storedLocation = sessionStorage.getItem("planco_location");
      if (stored) {
        const data = JSON.parse(stored) as Suggestion[];
        if (Array.isArray(data) && data.length > 0) setSuggestions(data);
      }
      if (storedLocation) setLocation(storedLocation);
    } catch {}
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim()) return;
    if (!supabase) {
      setError("Supabaseが設定されていません");
      return;
    }
    if (suggestions.length === 0) {
      setError("先にAIプランかカスタムルーレットで選択肢を用意してください");
      return;
    }

    setCreating(true);
    setError(null);

    const roomId = generateRoomId();
    const { error: dbError } = await supabase.from("rooms").insert({
      id: roomId,
      suggestions,
      location,
    });

    if (dbError) {
      setError("ルームの作成に失敗しました");
      setCreating(false);
      return;
    }

    sessionStorage.setItem("planco_nickname", nickname.trim());
    const url = `${window.location.origin}/room/${roomId}`;
    setRoomUrl(url);
    setCreating(false);
  };

  const handleCopy = async () => {
    if (!roomUrl) return;
    await navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnterRoom = () => {
    if (!roomUrl) return;
    const roomId = roomUrl.split("/").pop();
    router.push(`/room/${roomId}`);
  };

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
    >
      <div className="max-w-md mx-auto px-4 py-6">
        <header className="flex items-center mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex-1 text-center pr-9">
            <h1 className="text-xl font-extrabold text-white drop-shadow-md">
              友達と一緒に回す 👥
            </h1>
          </div>
        </header>

        {!roomUrl ? (
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl space-y-5">
            {/* Suggestions preview */}
            {suggestions.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">ルーレットの選択肢</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <span
                      key={s.id}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-500"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-2xl p-4 text-sm text-amber-600 font-bold">
                選択肢がありません。先にAIプランかカスタムルーレットを作成してください。
              </div>
            )}

            {/* Nickname input */}
            <div>
              <label className="flex items-center gap-2 text-sm font-extrabold text-gray-700 mb-2">
                <Users size={15} className="text-orange-400" />
                あなたのニックネーム
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例：たろう"
                maxLength={12}
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-orange-100 bg-orange-50 text-gray-700 font-bold placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:border-orange-300 text-sm"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-bold">{error}</p>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !nickname.trim() || suggestions.length === 0}
              className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
            >
              {creating ? "作成中..." : "ルームを作成する 🎡"}
            </button>
          </div>
        ) : (
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-extrabold text-gray-800 text-lg">ルームができました！</p>
              <p className="text-gray-400 text-sm mt-1">このURLを友達に共有しよう</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-2">
              <p className="flex-1 text-xs font-bold text-gray-600 break-all">{roomUrl}</p>
              <button
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-xl bg-orange-100 text-orange-400 hover:bg-orange-200 transition-colors active:scale-95"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <button
              onClick={handleEnterRoom}
              className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
            >
              ルームに入る！
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
