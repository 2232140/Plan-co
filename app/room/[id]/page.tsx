"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import RouletteWheel from "@/components/roulette-wheel";
import ResultModal from "@/components/result-modal";
import CandidateCard, { CommentItem } from "@/components/candidate-card";
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
  votes: Record<string, boolean>;
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

  // Vote sync via Presence
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  const [totalVotes, setTotalVotes] = useState<Record<string, number>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Comments via Broadcast (ephemeral)
  const [allComments, setAllComments] = useState<Record<string, CommentItem[]>>({});

  // Roulette
  const [activeTab, setActiveTab] = useState<"vote" | "roulette">("vote");
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [syncedSpinTarget, setSyncedSpinTarget] = useState<number | undefined>(undefined);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [spinnerNickname, setSpinnerNickname] = useState("");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const baseRotationRef = useRef(0);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected candidates for roulette (top voted or all)
  const selectedCandidates = useMemo(() => {
    if (!room) return [];
    const candidates = room.suggestions;
    const withVotes = candidates.filter((s) => (totalVotes[s.id] ?? 0) > 0);
    if (withVotes.length < 2) return candidates;
    return [...withVotes]
      .sort((a, b) => (totalVotes[b.id] ?? 0) - (totalVotes[a.id] ?? 0))
      .slice(0, 4);
  }, [room, totalVotes]);

  // Fetch room data
  useEffect(() => {
    if (!supabase) { setError("Supabaseが設定されていません"); setLoading(false); return; }
    supabase.from("rooms").select("*").eq("id", roomId).single().then(({ data, error: e }) => {
      if (e || !data) { setError("ルームが見つかりません"); }
      else { setRoom(data as RoomData); }
      setLoading(false);
    });
  }, [roomId]);

  // Load nickname
  useEffect(() => {
    const saved = sessionStorage.getItem("planco_nickname");
    if (saved) setNickname(saved);
    else setShowNicknameDialog(true);
  }, []);

  // Subscribe to Realtime
  useEffect(() => {
    if (!supabase || !nickname || !room) return;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Participant>();
        const list = Object.values(state).flat();
        setParticipants(list);

        // Compute total votes from all participants
        const totals: Record<string, number> = {};
        list.forEach((p) => {
          if (!p.votes) return;
          Object.entries(p.votes).forEach(([cid, voted]) => {
            if (voted) totals[cid] = (totals[cid] ?? 0) + 1;
          });
        });
        setTotalVotes(totals);
      })
      .on("broadcast", { event: "COMMENT_ADD" }, ({ payload }) => {
        const { candidateId, commentNickname, text } = payload as {
          candidateId: string;
          commentNickname: string;
          text: string;
        };
        const commentId = crypto.randomUUID();
        setAllComments((prev) => ({
          ...prev,
          [candidateId]: [
            ...(prev[candidateId] ?? []),
            { id: commentId, nickname: commentNickname, text },
          ].slice(-4),
        }));
        setTimeout(() => {
          setAllComments((prev) => ({
            ...prev,
            [candidateId]: (prev[candidateId] ?? []).filter((c) => c.id !== commentId),
          }));
        }, 8000);
      })
      .on("broadcast", { event: "ROULETTE_SPIN" }, ({ payload }) => {
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
          await channel.track({ nickname, userId, votes: myVotes });
        }
      });

    channelRef.current = channel;
    return () => { supabase?.removeChannel(channel); };
  }, [nickname, room, roomId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update presence when myVotes changes
  useEffect(() => {
    if (!channelRef.current || !nickname) return;
    channelRef.current.track({ nickname, userId, votes: myVotes });
  }, [myVotes, nickname, userId]);

  const handleVote = useCallback((candidateId: string) => {
    setMyVotes((prev) => ({ ...prev, [candidateId]: !prev[candidateId] }));
  }, []);

  const handleComment = useCallback((candidateId: string, text: string) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "COMMENT_ADD",
      payload: { candidateId, commentNickname: nickname, text },
    });
  }, [nickname]);

  const handleSpin = useCallback(() => {
    if (isSpinning || !channelRef.current || selectedCandidates.length === 0) return;
    const N = selectedCandidates.length;
    const SECTOR_ANGLE = 360 / N;
    const extra = Math.random() * 360;
    const newTarget = baseRotationRef.current + 360 * 7 + extra;
    const normalized = (360 - (newTarget % 360)) % 360;
    const winnerIdx = Math.floor(normalized / SECTOR_ANGLE) % N;
    const winnerName = selectedCandidates[winnerIdx].name;

    channelRef.current.send({
      type: "broadcast",
      event: "ROULETTE_SPIN",
      payload: { targetRotation: newTarget, winnerName, spinner: nickname },
    });
  }, [isSpinning, selectedCandidates, nickname]);

  const handleComplete = useCallback((name: string) => {
    const found = selectedCandidates.find((s) => s.name === name) ?? null;
    setSelectedSuggestion(found);
    setIsSpinning(false);
    setShowConfetti(true);
    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 2200);
  }, [selectedCandidates]);

  const handleDecide = () => {
    if (!selectedSuggestion || !room) return;
    saveHistory({
      type: "ai",
      conditions: { location: room.location },
      options: selectedCandidates.map((s) => s.name),
      selected_option: selectedSuggestion.name,
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: "Plan-co ルーム", url });
    else await navigator.clipboard.writeText(url);
  };

  const confirmNickname = () => {
    const name = pendingNickname.trim();
    if (!name) return;
    sessionStorage.setItem("planco_nickname", name);
    setNickname(name);
    setShowNicknameDialog(false);
  };

  // ---- Loading / Error ----
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-3 h-3 rounded-full bg-white animate-dot-pulse"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}>
        <p className="text-white font-extrabold text-xl">{error}</p>
        <button onClick={() => router.push("/")}
          className="px-6 py-3 rounded-2xl bg-white/30 text-white font-bold">
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
            <p className="text-gray-400 text-sm mb-4">ルーム内での表示名を決めよう 👋</p>
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
            <button onClick={confirmNickname} disabled={!pendingNickname.trim()}
              className="w-full py-3 rounded-2xl font-extrabold text-white shadow-lg disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
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

      <main className="min-h-screen pb-10"
        style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}>
        <div className="max-w-md mx-auto px-4 py-6">

          {/* Header */}
          <header className="flex items-center mb-4">
            <button onClick={() => router.push("/")}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-extrabold text-white drop-shadow-md">みんなで決める 👥</h1>
              <p className="text-white/70 text-xs font-bold">ROOM: {roomId}</p>
            </div>
            <button onClick={handleShare}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95">
              <Share2 size={18} className="text-white" />
            </button>
          </header>

          {/* Participants */}
          <div className="bg-white/25 rounded-2xl px-4 py-2 mb-4 flex flex-wrap gap-2 items-center">
            {participants.length === 0 ? (
              <span className="text-white/70 text-xs font-bold">参加者を待っています...</span>
            ) : (
              participants.map((p, i) => (
                <span key={i}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    p.nickname === nickname ? "bg-white text-orange-400" : "bg-white/40 text-white"
                  }`}>
                  {p.nickname === nickname ? `${p.nickname}（あなた）` : p.nickname}
                </span>
              ))
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white/25 rounded-2xl p-1 flex mb-5">
            <button onClick={() => setActiveTab("vote")}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
                activeTab === "vote" ? "bg-white text-orange-400 shadow-md" : "text-white/80 hover:text-white"
              }`}>
              ❤️ 投票
            </button>
            <button onClick={() => setActiveTab("roulette")}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
                activeTab === "roulette" ? "bg-white text-orange-400 shadow-md" : "text-white/80 hover:text-white"
              }`}>
              🎡 ルーレット
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "vote" ? (
              <motion.div key="vote"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-3">
                {/* Vote summary */}
                {Object.values(totalVotes).some((v) => v > 0) && (
                  <p className="text-white/80 text-xs font-bold text-center">
                    👑 ❤️ の多い上位{Math.min(selectedCandidates.length, 4)}件がルーレット対象です
                  </p>
                )}

                {room?.suggestions.map((s) => (
                  <CandidateCard
                    key={s.id}
                    id={s.id}
                    name={s.name}
                    budget={s.budget}
                    description={s.description}
                    totalLikes={totalVotes[s.id] ?? 0}
                    likedByMe={myVotes[s.id] ?? false}
                    comments={allComments[s.id] ?? []}
                    isSelectedForRoulette={selectedCandidates.some((sc) => sc.id === s.id)}
                    onVote={handleVote}
                    onComment={handleComment}
                  />
                ))}

                <button
                  onClick={() => setActiveTab("roulette")}
                  className="w-full py-4 rounded-2xl font-extrabold text-white text-base shadow-lg transition-all active:scale-95 mt-2"
                  style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
                  🎡 ルーレットで決める！
                </button>
              </motion.div>
            ) : (
              <motion.div key="roulette"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="space-y-4">
                {/* Selected candidates preview */}
                <div className="bg-white/30 rounded-2xl px-4 py-3">
                  <p className="text-white text-xs font-bold mb-2">
                    🎯 対象候補 ({selectedCandidates.length}件)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCandidates.map((s) => (
                      <span key={s.id}
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/70 text-orange-500">
                        {s.name}
                        {(totalVotes[s.id] ?? 0) > 0 && (
                          <span className="ml-1 text-rose-500">❤️{totalVotes[s.id]}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Wheel */}
                <div className="relative bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center overflow-hidden">
                  <ConfettiParticles show={showConfetti} />
                  {spinnerNickname && isSpinning && (
                    <p className="text-xs font-bold text-orange-400 mb-3 animate-pulse">
                      🎡 {spinnerNickname} がルーレットを回しています！
                    </p>
                  )}
                  <RouletteWheel
                    items={selectedCandidates.map((s) => s.name)}
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

                {/* Spin buttons */}
                <button onClick={handleSpin} disabled={isSpinning || !nickname}
                  className={`w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isSpinning ? "opacity-70 cursor-not-allowed" : "active:scale-95"
                  }`}
                  style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
                  {isSpinning ? "🌀 回転中..." : selectedSuggestion ? "🔄 もう一度回す" : "🎡 START"}
                </button>

                {selectedSuggestion && !isSpinning && (
                  <button onClick={() => setSelectedSuggestion(selectedSuggestion)}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg active:scale-95 bg-emerald-400 hover:bg-emerald-500 transition-all">
                    詳細を見る・ここに決定！
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
