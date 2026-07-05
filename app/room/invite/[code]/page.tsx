"use client";

import { useState, useEffect, useRef, use, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import SwingAvatar, { AVATAR_COLORS, AvatarColor } from "@/components/ui/swing-avatar";
import RouletteWheel from "@/components/roulette-wheel";
import ResultModal from "@/components/result-modal";
import { Suggestion } from "@/types/planco";

// ── Types ────────────────────────────────────────────────────────────────────

interface PresenceMember {
  nickname: string;
  avatar_color: string;
  is_host: boolean;
  userId: string;
}

interface VoteRow {
  id: string;
  member_id: string;
  tag_name: string;
}

interface Candidate {
  id: string;
  name: string;
  description: string;
  budget: string;
  reason: string;
}

interface LikeRow {
  id: string;
  candidate_id: string;
  member_id: string;
}

interface MemberRecord {
  id: string;
  nickname: string;
  avatar_color: string;
}

type Phase = "voting" | "suggesting" | "results" | "roulette";

// ── Constants ────────────────────────────────────────────────────────────────

const VOTE_TAGS = [
  { name: "食べたい", emoji: "🍜" },
  { name: "カフェ", emoji: "☕" },
  { name: "屋内", emoji: "🏠" },
  { name: "屋外", emoji: "🌞" },
  { name: "アクティブ", emoji: "🏃" },
  { name: "まったり", emoji: "😴" },
  { name: "映え", emoji: "📸" },
  { name: "エンタメ", emoji: "🎭" },
];

const HEART_PARTICLES = ["❤️", "💕", "💗", "✨"];

// ── Sub-components ───────────────────────────────────────────────────────────

function HeartParticles({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {HEART_PARTICLES.map((emoji, i) => (
        <span
          key={i}
          className="absolute text-lg animate-float-up"
          style={{ left: `${20 + i * 20}%`, bottom: "40%", animationDelay: `${i * 0.1}s` }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InviteRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  // Basic
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState("");
  const [myAvatarColor, setMyAvatarColor] = useState<AvatarColor>("orange");
  const [myIsHost, setMyIsHost] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [pendingNickname, setPendingNickname] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [copied, setCopied] = useState(false);

  // Phase & data
  const [phase, setPhase] = useState<Phase>("voting");
  const [memberRecords, setMemberRecords] = useState<MemberRecord[]>([]);
  const [voteRows, setVoteRows] = useState<VoteRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [likeRows, setLikeRows] = useState<LikeRow[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [likeAnimating, setLikeAnimating] = useState<string | null>(null);

  // Roulette
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [syncedTarget, setSyncedTarget] = useState<number | undefined>(undefined);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerCandidate, setWinnerCandidate] = useState<Candidate | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const baseRotationRef = useRef(0);

  const presenceRef = useRef<RealtimeChannel | null>(null);
  const realtimeRef = useRef<RealtimeChannel | null>(null);
  const broadcastRef = useRef<RealtimeChannel | null>(null);

  const formatCode = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

  // ── Computed ──────────────────────────────────────────────────────────────

  const tagVoteMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of VOTE_TAGS) map[t.name] = [];
    for (const v of voteRows) {
      if (map[v.tag_name] !== undefined) map[v.tag_name].push(v.member_id);
    }
    return map;
  }, [voteRows]);

  const myTagVoteSet = useMemo(
    () => new Set(voteRows.filter((v) => v.member_id === myMemberId).map((v) => v.tag_name)),
    [voteRows, myMemberId]
  );

  const likeCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of likeRows) map[l.candidate_id] = (map[l.candidate_id] ?? 0) + 1;
    return map;
  }, [likeRows]);

  const myLikeSet = useMemo(
    () => new Set(likeRows.filter((l) => l.member_id === myMemberId).map((l) => l.candidate_id)),
    [likeRows, myMemberId]
  );

  const memberColorMap = useMemo(() => {
    const map: Record<string, AvatarColor> = {};
    for (const m of memberRecords) map[m.id] = m.avatar_color as AvatarColor;
    return map;
  }, [memberRecords]);

  // Top 4 candidates by likes — used as roulette items
  const rouletteItems = useMemo(
    () =>
      [...candidates]
        .sort((a, b) => (likeCountMap[b.id] ?? 0) - (likeCountMap[a.id] ?? 0))
        .slice(0, 4),
    [candidates, likeCountMap]
  );

  // ── Initial data load ─────────────────────────────────────────────────────

  const loadInitialData = useCallback(
    async (rId: string, roomStatus: string, existingWinnerId: string | null) => {
      if (!supabase) return;

      const [membersRes, votesRes, candidatesRes] = await Promise.all([
        supabase.from("room_members").select("id, nickname, avatar_color").eq("room_id", rId),
        supabase.from("room_votes").select("id, member_id, tag_name").eq("room_id", rId),
        supabase
          .from("room_candidates")
          .select("id, name, description, budget, reason")
          .eq("room_id", rId)
          .order("created_at"),
      ]);

      if (membersRes.data) setMemberRecords(membersRes.data as MemberRecord[]);
      if (votesRes.data) setVoteRows(votesRes.data as VoteRow[]);

      const cands = (candidatesRes.data ?? []) as Candidate[];
      if (cands.length > 0) {
        setCandidates(cands);
        setPhase(roomStatus === "roulette" ? "roulette" : "results");

        const { data: likeData } = await supabase
          .from("room_candidate_likes")
          .select("id, candidate_id, member_id");
        if (likeData) {
          const cids = new Set(cands.map((c) => c.id));
          setLikeRows((likeData as LikeRow[]).filter((l) => cids.has(l.candidate_id)));
        }

        if (existingWinnerId) {
          const winner = cands.find((c) => c.id === existingWinnerId);
          if (winner) setWinnerCandidate(winner);
        }
      }
    },
    []
  );

  // ── Fetch room on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase) {
      setError("Supabaseが設定されていません");
      setLoading(false);
      return;
    }

    supabase
      .from("rooms")
      .select("id, status, selected_candidate_id")
      .eq("invite_code", code)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) {
          setError("ルームが見つかりません");
          setLoading(false);
          return;
        }

        const rId = data.id as string;
        const roomStatus = (data.status as string) ?? "setup";
        const existingWinnerId = (data.selected_candidate_id as string | null) ?? null;
        setRoomId(rId);
        if (roomStatus === "roulette") setPhase("roulette");

        const savedNickname = sessionStorage.getItem("planco_nickname");
        const savedColor = sessionStorage.getItem("planco_avatar_color") as AvatarColor | null;
        const savedIsHost = sessionStorage.getItem("planco_is_host") === "true";
        const savedMemberId = sessionStorage.getItem("planco_memberId");
        let savedUserId = sessionStorage.getItem("planco_userId");
        if (!savedUserId) {
          savedUserId = crypto.randomUUID();
          sessionStorage.setItem("planco_userId", savedUserId);
        }

        if (savedMemberId) setMyMemberId(savedMemberId);

        if (savedNickname && savedColor) {
          setMyNickname(savedNickname);
          setMyAvatarColor(savedColor);
          setMyIsHost(savedIsHost);
          setMyUserId(savedUserId);
          setLoading(false);
        } else {
          setMyUserId(savedUserId);
          setShowNicknameDialog(true);
          setLoading(false);
        }

        loadInitialData(rId, roomStatus, existingWinnerId);
      });
  }, [code, loadInitialData]);

  // ── Presence channel ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !myNickname || !myUserId || !roomId) return;

    const channel = supabase.channel(`room-invite-${code}`, {
      config: { presence: { key: myUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMember>();
        const raw = Object.values(state).flat() as PresenceMember[];
        const seen = new Set<string>();
        const unique = raw.filter((p) => {
          if (seen.has(p.userId)) return false;
          seen.add(p.userId);
          return true;
        });
        setMembers(unique);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            nickname: myNickname,
            avatar_color: myAvatarColor,
            is_host: myIsHost,
            userId: myUserId,
          });
        }
      });

    presenceRef.current = channel;
    return () => { supabase?.removeChannel(channel); };
  }, [myNickname, myAvatarColor, myIsHost, myUserId, roomId, code]);

  // ── Realtime DB changes ───────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !roomId) return;

    const channel = supabase
      .channel(`room-step3-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as { status?: string; selected_candidate_id?: string };
          if (updated.status === "roulette") setPhase("roulette");
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_votes", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as VoteRow;
          setVoteRows((prev) => [
            ...prev.filter((v) => !(v.member_id === row.member_id && v.tag_name === row.tag_name)),
            row,
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "room_votes", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.old as { id: string };
          setVoteRows((prev) => prev.filter((v) => v.id !== row.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_candidates", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newCand = payload.new as Candidate;
          setCandidates((prev) => [...prev.filter((c) => c.id !== newCand.id), newCand]);
          setPhase("results");
          setSuggesting(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_candidate_likes" },
        (payload) => {
          const row = payload.new as LikeRow;
          setLikeRows((prev) => [
            ...prev.filter((l) => !(l.candidate_id === row.candidate_id && l.member_id === row.member_id)),
            row,
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "room_candidate_likes" },
        (payload) => {
          const row = payload.old as { id: string };
          setLikeRows((prev) => prev.filter((l) => l.id !== row.id));
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => { supabase?.removeChannel(channel); };
  }, [roomId]);

  // ── Broadcast channel (roulette spin sync) ────────────────────────────────

  useEffect(() => {
    if (!supabase || !roomId) return;

    const channel = supabase.channel(`room-bc-${roomId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "SPIN" }, ({ payload }) => {
        const { targetRotation } = payload as { targetRotation: number };
        baseRotationRef.current = targetRotation;
        setSyncedTarget(targetRotation);
        setSpinTrigger((t) => t + 1);
        setIsSpinning(true);
        setWinnerCandidate(null);
        setShowWinnerModal(false);
      })
      .subscribe();

    broadcastRef.current = channel;
    return () => { supabase?.removeChannel(channel); };
  }, [roomId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDialogJoin = async () => {
    const name = pendingNickname.trim();
    if (!name || !supabase || !roomId) return;

    setJoiningRoom(true);
    try {
      const { data: existingMembers } = await supabase
        .from("room_members")
        .select("avatar_color")
        .eq("room_id", roomId);

      const usedColors = (existingMembers ?? []).map((m: { avatar_color: string }) => m.avatar_color);
      const unusedColors = AVATAR_COLORS.filter((c) => !usedColors.includes(c));
      const available = unusedColors.length > 0 ? unusedColors : [...AVATAR_COLORS];
      const color = available[Math.floor(Math.random() * available.length)] as AvatarColor;

      const { data: memberData } = await supabase
        .from("room_members")
        .insert({ room_id: roomId, nickname: name, avatar_color: color, is_host: false })
        .select("id")
        .single();

      if (memberData) {
        sessionStorage.setItem("planco_memberId", memberData.id);
        setMyMemberId(memberData.id);
      }

      sessionStorage.setItem("planco_nickname", name);
      sessionStorage.setItem("planco_avatar_color", color);
      sessionStorage.setItem("planco_is_host", "false");

      setMyNickname(name);
      setMyAvatarColor(color);
      setMyIsHost(false);
      setShowNicknameDialog(false);

      const { data: updatedMembers } = await supabase
        .from("room_members")
        .select("id, nickname, avatar_color")
        .eq("room_id", roomId);
      if (updatedMembers) setMemberRecords(updatedMembers as MemberRecord[]);
    } catch {
      // silently ignore
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleTagVote = async (tagName: string) => {
    if (!supabase || !myMemberId || !roomId) return;
    const alreadyVoted = myTagVoteSet.has(tagName);

    if (alreadyVoted) {
      setVoteRows((prev) =>
        prev.filter((v) => !(v.member_id === myMemberId && v.tag_name === tagName))
      );
      await supabase
        .from("room_votes")
        .delete()
        .eq("room_id", roomId)
        .eq("member_id", myMemberId)
        .eq("tag_name", tagName);
    } else {
      const tempId = `temp-${Date.now()}`;
      setVoteRows((prev) => [...prev, { id: tempId, member_id: myMemberId, tag_name: tagName }]);
      const { data } = await supabase
        .from("room_votes")
        .insert({ room_id: roomId, member_id: myMemberId, tag_name: tagName })
        .select("id")
        .single();
      if (data) {
        setVoteRows((prev) => prev.map((v) => (v.id === tempId ? { ...v, id: data.id } : v)));
      }
    }
  };

  const handleDecide = async () => {
    if (!supabase || !roomId || suggesting) return;
    setSuggestError(null);
    setSuggesting(true);

    const topTags = Object.entries(tagVoteMap)
      .filter(([, voters]) => voters.length > 0)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([tag]) => tag);

    try {
      const res = await fetch("/api/suggest-group-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, tags: topTags }),
      });
      if (!res.ok) {
        const { error: errMsg } = await res.json();
        throw new Error(errMsg ?? "AI提案に失敗しました");
      }
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "AI提案に失敗しました");
      setSuggesting(false);
    }
  };

  const handleLike = async (candidateId: string) => {
    if (!supabase || !myMemberId) return;
    const alreadyLiked = myLikeSet.has(candidateId);

    if (alreadyLiked) {
      setLikeRows((prev) =>
        prev.filter((l) => !(l.candidate_id === candidateId && l.member_id === myMemberId))
      );
      await supabase
        .from("room_candidate_likes")
        .delete()
        .eq("candidate_id", candidateId)
        .eq("member_id", myMemberId);
    } else {
      setLikeAnimating(candidateId);
      setTimeout(() => setLikeAnimating(null), 900);
      const tempId = `temp-${Date.now()}`;
      setLikeRows((prev) => [...prev, { id: tempId, candidate_id: candidateId, member_id: myMemberId }]);
      const { data } = await supabase
        .from("room_candidate_likes")
        .insert({ candidate_id: candidateId, member_id: myMemberId })
        .select("id")
        .single();
      if (data) {
        setLikeRows((prev) => prev.map((l) => (l.id === tempId ? { ...l, id: data.id } : l)));
      }
    }
  };

  const handleStartRoulette = async () => {
    if (!supabase || !roomId) return;
    setPhase("roulette"); // optimistic
    await supabase.from("rooms").update({ status: "roulette" }).eq("id", roomId);
  };

  const handleSpin = useCallback(() => {
    if (isSpinning || rouletteItems.length === 0 || !broadcastRef.current) return;

    const N = rouletteItems.length;
    const SECTOR_ANGLE = 360 / N;
    const extra = Math.random() * 360;
    const newTarget = baseRotationRef.current + 360 * 7 + extra;
    const normalized = (360 - (newTarget % 360)) % 360;
    const winnerIdx = Math.floor(normalized / SECTOR_ANGLE) % N;
    const winnerName = rouletteItems[winnerIdx].name;

    broadcastRef.current.send({
      type: "broadcast",
      event: "SPIN",
      payload: { targetRotation: newTarget, winnerName, startTime: Date.now() },
    });
  }, [isSpinning, rouletteItems]);

  const handleRouletteComplete = useCallback(
    (winnerName: string) => {
      const found = rouletteItems.find((c) => c.name === winnerName) ?? null;
      setWinnerCandidate(found);
      setIsSpinning(false);
      if (found) setShowWinnerModal(true);

      // Confetti
      if (typeof window !== "undefined") {
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
          setTimeout(
            () => confetti({ particleCount: 80, spread: 120, origin: { y: 0.8, x: 0.1 } }),
            350
          );
          setTimeout(
            () => confetti({ particleCount: 80, spread: 120, origin: { y: 0.8, x: 0.9 } }),
            700
          );
        });
      }

      // Persist winner to DB
      if (supabase && roomId && found) {
        supabase.from("rooms").update({ selected_candidate_id: found.id }).eq("id", roomId);
      }
    },
    [rouletteItems, roomId]
  );

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: "Plan-co ルーム", url });
    else await navigator.clipboard.writeText(url);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

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
              onKeyDown={(e) => e.key === "Enter" && handleDialogJoin()}
              placeholder="例：はなこ"
              maxLength={12}
              autoFocus
              className="w-full px-4 py-2.5 rounded-2xl border-2 border-orange-100 bg-orange-50 text-gray-700 font-bold placeholder:text-gray-300 focus:outline-none focus:border-orange-300 text-sm mb-4"
            />
            <button
              onClick={handleDialogJoin}
              disabled={!pendingNickname.trim() || joiningRoom}
              className="w-full py-3 rounded-2xl font-extrabold text-white shadow-lg disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
            >
              {joiningRoom ? "参加中..." : "参加する 🎡"}
            </button>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      <ResultModal
        suggestion={showWinnerModal ? (winnerCandidate as unknown as Suggestion) : null}
        location=""
        onClose={() => setShowWinnerModal(false)}
        onReSpin={() => {
          setShowWinnerModal(false);
          setWinnerCandidate(null);
          if (myIsHost) handleSpin();
        }}
        reSpinLabel="もう一度回す"
      />

      <main
        className="min-h-screen pb-10"
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
            <div className="flex-1 text-center">
              <h1 className="text-xl font-extrabold text-white drop-shadow-md">
                {phase === "roulette" ? "🎡 ルーレット！" : "みんなで決める 👥"}
              </h1>
            </div>
            <button
              onClick={handleShare}
              className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
            >
              <Share2 size={18} className="text-white" />
            </button>
          </header>

          {/* Invite code */}
          {phase !== "roulette" && (
            <div className="bg-white rounded-3xl p-5 shadow-2xl mb-5">
              <p className="text-xs font-extrabold text-gray-400 mb-2 text-center tracking-widest uppercase">
                招待コード
              </p>
              <div className="flex items-center justify-center gap-4">
                <p className="text-4xl font-extrabold tracking-widest text-gray-800">
                  {formatCode(code)}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl bg-orange-100 text-orange-400 hover:bg-orange-200 transition-colors active:scale-95"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <p className="text-white font-extrabold text-center mb-3 text-lg">
            {members.length}人 が参加中
          </p>
          <div
            className="rounded-3xl p-5 shadow-xl mb-5 flex flex-wrap gap-4 justify-center min-h-[80px] items-center"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            {members.length === 0 ? (
              <p className="text-white/70 font-bold text-sm">友達の参加を待っています...</p>
            ) : (
              <AnimatePresence>
                {members.map((m) => (
                  <motion.div
                    key={m.userId}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <SwingAvatar color={m.avatar_color as AvatarColor} size={60} swing />
                    <p className="text-white font-bold text-xs">
                      {m.nickname}
                      {m.nickname === myNickname && (
                        <span className="text-white/70 font-normal">（あなた）</span>
                      )}
                    </p>
                    {m.is_host && <p className="text-white/80 text-xs">👑</p>}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* ── Phase content ────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* VOTING */}
            {phase === "voting" && (
              <motion.div
                key="voting"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-3xl p-5 shadow-xl">
                  <p className="text-sm font-extrabold text-gray-700 mb-1 text-center">
                    やりたいことを選ぼう 🗳️
                  </p>
                  <p className="text-xs text-gray-400 text-center mb-4">
                    タップで投票（複数OK）
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {VOTE_TAGS.map((tag) => {
                      const voters = tagVoteMap[tag.name] ?? [];
                      const voted = myTagVoteSet.has(tag.name);
                      return (
                        <motion.button
                          key={tag.name}
                          onClick={() => handleTagVote(tag.name)}
                          whileTap={{ scale: 0.92 }}
                          className={`relative rounded-2xl px-3 py-4 flex flex-col items-center gap-1 transition-all border-2 ${
                            voted
                              ? "border-orange-300 bg-orange-50 shadow-md"
                              : "border-gray-100 bg-gray-50 hover:border-orange-200"
                          }`}
                        >
                          {voters.length > 0 && (
                            <div className="flex justify-center gap-0.5 mb-1 flex-wrap">
                              {voters.slice(0, 4).map((memberId) => (
                                <SwingAvatar
                                  key={memberId}
                                  color={(memberColorMap[memberId] ?? "orange") as AvatarColor}
                                  size={20}
                                  swing={false}
                                />
                              ))}
                              {voters.length > 4 && (
                                <span className="text-xs text-gray-400 font-bold self-end">
                                  +{voters.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-2xl">{tag.emoji}</span>
                          <span className={`text-xs font-extrabold ${voted ? "text-orange-500" : "text-gray-600"}`}>
                            {tag.name}
                          </span>
                          {voters.length > 0 && (
                            <span className="text-xs font-bold text-orange-400">{voters.length}票</span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {myIsHost && (
                  <div className="space-y-2">
                    {suggestError && (
                      <p className="text-white font-bold text-sm text-center bg-red-400/80 rounded-2xl px-4 py-2">
                        {suggestError}
                      </p>
                    )}
                    <button
                      onClick={handleDecide}
                      disabled={suggesting}
                      className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 disabled:opacity-70"
                      style={{ background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)" }}
                    >
                      {suggesting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-2 h-2 rounded-full bg-white animate-dot-pulse"
                                style={{ animationDelay: `${i * 0.2}s` }}
                              />
                            ))}
                          </span>
                          AIが考え中...
                        </span>
                      ) : (
                        "これで決定！🚀"
                      )}
                    </button>
                    <p className="text-white/70 text-xs text-center">
                      ホストのみ表示 · 押すとAIがスポットを提案します
                    </p>
                  </div>
                )}

                {!myIsHost && members.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/30 rounded-2xl px-5 py-3 text-center"
                  >
                    <p className="text-white font-extrabold text-base">🎉 みんな集まってきたね！</p>
                    <p className="text-white/80 text-sm mt-1">ホストが決定するまで投票しよう ✨</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* RESULTS */}
            {phase === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-4"
              >
                <p className="text-white font-extrabold text-center text-lg">🎯 AIのおすすめスポット</p>
                <p className="text-white/70 text-center text-sm -mt-2">❤️ で気に入ったを教えよう！</p>

                <AnimatePresence>
                  {candidates.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, scale: 0.92, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: idx * 0.12, type: "spring", stiffness: 260, damping: 22 }}
                      className="bg-white rounded-3xl p-5 shadow-xl relative overflow-hidden"
                    >
                      <HeartParticles show={likeAnimating === c.id} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-extrabold text-gray-800 text-base">{c.name}</p>
                          <p className="text-orange-400 font-bold text-xs mt-0.5">{c.budget}</p>
                          <p className="text-gray-500 text-sm mt-2 leading-relaxed">{c.description}</p>
                          <p className="text-gray-400 text-xs mt-2 italic">💡 {c.reason}</p>
                        </div>
                        <button
                          onClick={() => handleLike(c.id)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl transition-all active:scale-90 min-w-[52px] ${
                            myLikeSet.has(c.id)
                              ? "bg-rose-50 text-rose-500"
                              : "bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-400"
                          }`}
                        >
                          <span className={`text-2xl ${myLikeSet.has(c.id) ? "animate-heart-pop" : ""}`}>
                            {myLikeSet.has(c.id) ? "❤️" : "🤍"}
                          </span>
                          <span className="text-xs font-extrabold">{likeCountMap[c.id] ?? 0}</span>
                        </button>
                      </div>
                      {(likeCountMap[c.id] ?? 0) > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-rose-400 rounded-full"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min(100, ((likeCountMap[c.id] ?? 0) / Math.max(members.length, 1)) * 100)}%`,
                              }}
                              transition={{ duration: 0.4 }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 font-bold whitespace-nowrap">
                            {likeCountMap[c.id]}人が❤️
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Host: start roulette */}
                {myIsHost && candidates.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 pt-2"
                  >
                    <button
                      onClick={handleStartRoulette}
                      className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95"
                      style={{ background: "linear-gradient(135deg, #FB923C 0%, #F472B6 100%)" }}
                    >
                      みんなで決める 🎡
                    </button>
                    <p className="text-white/70 text-xs text-center">
                      ホストのみ表示 · ❤️ の多い順でルーレットが始まります
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ROULETTE */}
            {phase === "roulette" && (
              <motion.div
                key="roulette"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Top items */}
                <div className="bg-white/30 rounded-2xl px-4 py-3">
                  <p className="text-white text-xs font-bold mb-2">❤️ いいね上位スポット</p>
                  <div className="flex flex-wrap gap-2">
                    {rouletteItems.map((c) => (
                      <span
                        key={c.id}
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/70 text-orange-500"
                      >
                        {c.name}
                        {(likeCountMap[c.id] ?? 0) > 0 && (
                          <span className="ml-1 text-rose-500">❤️{likeCountMap[c.id]}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Wheel */}
                <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center">
                  {isSpinning && (
                    <p className="text-xs font-bold text-orange-400 mb-3 animate-pulse">
                      🎡 ルーレット回転中...
                    </p>
                  )}
                  <RouletteWheel
                    items={rouletteItems.map((c) => c.name)}
                    spinTrigger={spinTrigger}
                    onComplete={handleRouletteComplete}
                    syncedTarget={syncedTarget}
                  />
                  {winnerCandidate && !isSpinning && (
                    <div className="mt-5 text-center animate-pop-in">
                      <p className="text-xs text-gray-400 font-bold tracking-widest">決まりました！</p>
                      <p className="text-3xl font-extrabold text-orange-500 mt-1">
                        {winnerCandidate.name} 🎉
                      </p>
                    </div>
                  )}
                </div>

                {/* Host: spin / Guest: wait */}
                {myIsHost ? (
                  <button
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 disabled:opacity-70"
                    style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
                  >
                    {isSpinning ? "🌀 回転中..." : winnerCandidate ? "🔄 もう一度回す" : "回す！🎡"}
                  </button>
                ) : (
                  <div className="bg-white/30 rounded-2xl px-5 py-4 text-center">
                    {isSpinning ? (
                      <p className="text-white font-extrabold text-base animate-pulse">
                        🎡 回っています！ドキドキ...
                      </p>
                    ) : (
                      <p className="text-white font-extrabold text-base">
                        ⏳ ホストが回すのを待っています...
                      </p>
                    )}
                  </div>
                )}

                {/* Show result again */}
                {winnerCandidate && !isSpinning && (
                  <button
                    onClick={() => setShowWinnerModal(true)}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg active:scale-95 bg-emerald-400 hover:bg-emerald-500 transition-all"
                  >
                    詳細を見る・ここに決定！✨
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
