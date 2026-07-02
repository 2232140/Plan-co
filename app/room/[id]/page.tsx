"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, Share2 } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import RouletteWheel from "@/components/roulette-wheel";
import ResultModal from "@/components/result-modal";
import { Suggestion } from "@/types/planco";
import { saveHistory } from "@/lib/history";

interface RoomData {
  id: string;
  suggestions: Suggestion[];
  location: string;
}

interface Participant {
  nickname: string;
  userId: string;
}

const CONFETTI_EMOJIS = ["🎉", "✨", "🎊", "⭐", "🌟", "💫"];

function ConfettiParticles({ show }: { show: boolean }) {
  if (!show) return null;
  const particles = Array.from({ length: 12 }, (_, i) => ({
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

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [pendingNickname, setPendingNickname] = useState("");
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);

  const [userId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const saved = sessionStorage.getItem("planco_userId");
    if (saved) return saved;
    const newId = crypto.randomUUID();
    sessionStorage.setItem("planco_userId", newId);
    return newId;
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [spinnerNickname, setSpinnerNickname] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [syncedSpinTarget, setSyncedSpinTarget] = useState<number | undefined>(undefined);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const baseRotationRef = useRef(0);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch room data
  useEffect(() => {
    if (!supabase) {
      setError("Supabaseが設定されていません");
      setLoading(false);
      return;
    }
    supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single()
      .then(({ data, error: dbError }) => {
        if (dbError || !data) {
          setError("ルームが見つかりません");
        } else {
          setRoom(data as RoomData);
        }
        setLoading(false);
      });
  }, [roomId]);

  // Load nickname from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("planco_nickname");
    if (saved) {
      setNickname(saved);
    } else {
      setShowNicknameDialog(true);
    }
  }, []);

  // Subscribe to Realtime channel when nickname and room are ready
  useEffect(() => {
    if (!supabase || !nickname || !room) return;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ nickname: string; userId: string }>();
        const list = Object.values(state).flat();
        setParticipants(list);
      })
      .on("broadcast", { event: "roulette_spin" }, ({ payload }) => {
        const { targetRotation, spinner } = payload as {
          targetRotation: number;
          winnerName: string;
          spinner: string;
        };
        baseRotationRef.current = targetRotation;
        setSyncedSpinTarget(targetRotation);
        setSpinTrigger((t) => t + 1);
        setIsSpinning(true);
        setSpinnerNickname(spinner);
        setSelectedSuggestion(null);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ nickname, userId });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [nickname, room, roomId, userId]);

  const handleSpin = useCallback(() => {
    if (isSpinning || !room || !channelRef.current) return;

    const N = room.suggestions.length;
    const SECTOR_ANGLE = 360 / N;
    const extra = Math.random() * 360;
    const newTarget = baseRotationRef.current + 360 * 7 + extra;

    const normalized = (360 - (newTarget % 360)) % 360;
    const winnerIdx = Math.floor(normalized / SECTOR_ANGLE) % N;
    const winnerName = room.suggestions[winnerIdx].name;

    channelRef.current.send({
      type: "broadcast",
      event: "roulette_spin",
      payload: { targetRotation: newTarget, winnerName, spinner: nickname },
    });
  }, [isSpinning, room, nickname]);

  const handleComplete = useCallback(
    (name: string) => {
      const found = room?.suggestions.find((s) => s.name === name) ?? null;
      setSelectedSuggestion(found);
      setIsSpinning(false);
      setShowConfetti(true);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 2200);
    },
    [room]
  );

  const handleDecide = () => {
    if (!selectedSuggestion || !room) return;
    saveHistory({
      type: "ai",
      conditions: { location: room.location },
      options: room.suggestions.map((s) => s.name),
      selected_option: selectedSuggestion.name,
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Plan-co ルーム", url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const confirmNickname = () => {
    const name = pendingNickname.trim();
    if (!name) return;
    sessionStorage.setItem("planco_nickname", name);
    setNickname(name);
    setShowNicknameDialog(false);
  };

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full bg-white animate-dot-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
      >
        <p className="text-white font-extrabold text-xl">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-2xl bg-white/30 text-white font-bold"
        >
          ホームに戻る
        </button>
      </main>
    );
  }

  return (
    <>
      {/* Nickname Dialog */}
      {showNicknameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-extrabold text-gray-800 mb-1">ニックネームを入力</h2>
            <p className="text-gray-400 text-sm mb-4">ルーム内での表示名を決めよう👋</p>
            <input
              type="text"
              value={pendingNickname}
              onChange={(e) => setPendingNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmNickname()}
              placeholder="例：はなこ"
              maxLength={12}
              autoFocus
              className="w-full px-4 py-2.5 rounded-2xl border-2 border-orange-100 bg-orange-50 text-gray-700 font-bold placeholder:text-gray-300 focus:outline-none focus:border-orange-300 text-sm mb-4"
            />
            <button
              onClick={confirmNickname}
              disabled={!pendingNickname.trim()}
              className="w-full py-3 rounded-2xl font-extrabold text-white shadow-lg disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
            >
              参加する 🎡
            </button>
          </div>
        </div>
      )}

      <ResultModal
        suggestion={selectedSuggestion}
        location={room?.location ?? "どこでも"}
        onClose={() => setSelectedSuggestion(null)}
        onReSpin={() => { setSelectedSuggestion(null); handleSpin(); }}
        onDecide={handleDecide}
      />

      <main
        className="min-h-screen"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
      >
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header */}
          <header className="flex items-center mb-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-extrabold text-white drop-shadow-md">
                みんなで決める 👥
              </h1>
              <p className="text-white/70 text-xs font-bold">ROOM: {roomId}</p>
            </div>
            <button
              onClick={handleShare}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
            >
              <Share2 size={18} className="text-white" />
            </button>
          </header>

          {/* Participants */}
          <div className="bg-white/30 rounded-2xl px-4 py-2.5 mb-4 flex items-center gap-2 flex-wrap">
            <Users size={14} className="text-white shrink-0" />
            {participants.length === 0 ? (
              <span className="text-white/70 text-xs font-bold">参加者を待っています...</span>
            ) : (
              participants.map((p, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    p.nickname === nickname
                      ? "bg-white text-orange-400"
                      : "bg-white/40 text-white"
                  }`}
                >
                  {p.nickname === nickname ? `${p.nickname}（あなた）` : p.nickname}
                </span>
              ))
            )}
          </div>

          {/* Wheel */}
          <div className="relative bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center overflow-hidden mb-4">
            <ConfettiParticles show={showConfetti} />

            {spinnerNickname && isSpinning && (
              <p className="text-xs font-bold text-orange-400 mb-3 animate-pulse">
                🎡 {spinnerNickname} がルーレットを回しています！
              </p>
            )}

            <RouletteWheel
              items={room?.suggestions.map((s) => s.name) ?? []}
              spinTrigger={spinTrigger}
              onComplete={handleComplete}
              syncedTarget={syncedSpinTarget}
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

          {/* Spin button */}
          <div className="space-y-3">
            <button
              onClick={handleSpin}
              disabled={isSpinning || !nickname}
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
                className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg active:scale-95 bg-emerald-400 hover:bg-emerald-500 transition-all"
              >
                詳細を見る・ここに決定！
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
