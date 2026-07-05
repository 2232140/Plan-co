"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, Users } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import SwingAvatar, { AVATAR_COLORS, AvatarColor } from "@/components/ui/swing-avatar";

type Tab = "create" | "join";

async function generateInviteCode(): Promise<string> {
  if (!supabase) throw new Error("Supabaseが設定されていません");
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data } = await supabase
      .from("rooms")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("招待コードの生成に失敗しました");
}

export default function JoinPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("create");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create tab state
  const [previewColor] = useState<AvatarColor>(
    () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  );
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Join tab state
  const [codeInput, setCodeInput] = useState("");

  const handleCreate = async () => {
    if (!nickname.trim()) return;
    if (!supabase) { setError("Supabaseが設定されていません"); return; }

    setLoading(true);
    setError(null);

    try {
      const code = await generateInviteCode();
      const roomId = crypto.randomUUID();

      const { error: roomErr } = await supabase.from("rooms").insert({
        id: roomId,
        invite_code: code,
        status: "setup",
      });
      if (roomErr) throw new Error("ルームの作成に失敗しました");

      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const { data: memberData, error: memberErr } = await supabase.from("room_members").insert({
        room_id: roomId,
        nickname: nickname.trim(),
        avatar_color: color,
        is_host: true,
      }).select("id").single();
      if (memberErr || !memberData) throw new Error("メンバーの登録に失敗しました");

      sessionStorage.setItem("planco_nickname", nickname.trim());
      sessionStorage.setItem("planco_avatar_color", color);
      sessionStorage.setItem("planco_is_host", "true");
      sessionStorage.setItem("planco_userId", crypto.randomUUID());
      sessionStorage.setItem("planco_memberId", memberData.id);

      setCreatedCode(code);
      setCreatedRoomId(roomId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim() || codeInput.length !== 6) return;
    if (!supabase) { setError("Supabaseが設定されていません"); return; }

    setLoading(true);
    setError(null);

    try {
      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .select("id")
        .eq("invite_code", codeInput)
        .maybeSingle();

      if (roomErr || !room) {
        throw new Error("招待コードが間違っているか、ルームが存在しません");
      }

      // Get existing colors to pick unused one
      const { data: existingMembers } = await supabase
        .from("room_members")
        .select("avatar_color")
        .eq("room_id", room.id);

      const usedColors = (existingMembers ?? []).map((m: { avatar_color: string }) => m.avatar_color);
      const unusedColors = AVATAR_COLORS.filter((c) => !usedColors.includes(c));
      const available = unusedColors.length > 0 ? unusedColors : [...AVATAR_COLORS];
      const color = available[Math.floor(Math.random() * available.length)] as AvatarColor;

      const { data: memberData, error: memberErr } = await supabase.from("room_members").insert({
        room_id: room.id,
        nickname: nickname.trim(),
        avatar_color: color,
        is_host: false,
      }).select("id").single();
      if (memberErr || !memberData) throw new Error("ルームへの参加に失敗しました");

      sessionStorage.setItem("planco_nickname", nickname.trim());
      sessionStorage.setItem("planco_avatar_color", color);
      sessionStorage.setItem("planco_is_host", "false");
      sessionStorage.setItem("planco_userId", crypto.randomUUID());
      sessionStorage.setItem("planco_memberId", memberData.id);

      router.push(`/room/invite/${codeInput}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnterRoom = () => {
    if (!createdCode) return;
    router.push(`/room/invite/${createdCode}`);
  };

  const formatCode = (code: string) =>
    `${code.slice(0, 3)} ${code.slice(3)}`;

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
    >
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex-1 text-center pr-9">
            <h1 className="text-xl font-extrabold text-white drop-shadow-md">
              友達と決める 👥
            </h1>
          </div>
        </header>

        {/* Tab switcher */}
        <div className="bg-white/25 rounded-2xl p-1 flex mb-5">
          <button
            onClick={() => { setTab("create"); setError(null); }}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
              tab === "create"
                ? "bg-white text-orange-400 shadow-md"
                : "text-white/80 hover:text-white"
            }`}
          >
            ルームを作る
          </button>
          <button
            onClick={() => { setTab("join"); setError(null); }}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
              tab === "join"
                ? "bg-white text-orange-400 shadow-md"
                : "text-white/80 hover:text-white"
            }`}
          >
            招待コードで入室
          </button>
        </div>

        <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-2xl space-y-5">
          {/* Nickname (shared) */}
          {!createdCode && (
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
          )}

          {tab === "create" && !createdCode && (
            <>
              <p className="text-gray-500 text-sm text-center">
                6桁のコードが生成され、友達を招待できます
              </p>

              {/* Avatar preview */}
              <div className="flex flex-col items-center gap-2 py-2">
                <SwingAvatar color={previewColor} size={80} swing={true} />
                <p className="text-gray-400 text-xs font-bold">あなたのアバター</p>
              </div>

              {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

              <button
                onClick={handleCreate}
                disabled={loading || !nickname.trim()}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
              >
                {loading ? "作成中..." : "ルームを作る 🎡"}
              </button>
            </>
          )}

          {tab === "create" && createdCode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="font-extrabold text-gray-800 text-lg">ルームができました！</p>
                <p className="text-gray-400 text-sm mt-1">このコードを友達に共有しよう</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 flex items-center justify-between">
                <p className="text-4xl font-extrabold tracking-widest text-gray-800">
                  {formatCode(createdCode)}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="p-3 rounded-xl bg-orange-100 text-orange-400 hover:bg-orange-200 transition-colors active:scale-95"
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>

              <button
                onClick={handleEnterRoom}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
              >
                ルームに入る！
              </button>
            </motion.div>
          )}

          {tab === "join" && (
            <>
              <div>
                <label className="text-sm font-extrabold text-gray-700 mb-2 block">
                  招待コード（6桁）
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-orange-100 bg-orange-50 text-gray-700 font-extrabold text-2xl tracking-widest placeholder:text-gray-300 placeholder:font-normal placeholder:text-base focus:outline-none focus:border-orange-300 text-center"
                />
              </div>

              {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

              <button
                onClick={handleJoin}
                disabled={loading || !nickname.trim() || codeInput.length !== 6}
                className="w-full py-4 rounded-2xl font-extrabold text-white text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
              >
                {loading ? "参加中..." : "ルームに参加 🎡"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
