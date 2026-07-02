"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Crown } from "lucide-react";

export interface CommentItem {
  id: string;
  nickname: string;
  text: string;
}

interface CandidateCardProps {
  id: string;
  name: string;
  budget: string;
  description: string;
  totalLikes: number;
  likedByMe: boolean;
  comments: CommentItem[];
  isSelectedForRoulette: boolean;
  onVote: (id: string) => void;
  onComment: (id: string, text: string) => void;
}

// Fixed trajectories for heart burst particles
const BURST_PATHS = [
  { x: -28, y: -44, rotate: -15 },
  { x: 28, y: -44, rotate: 15 },
  { x: 0,  y: -56, rotate: 0 },
  { x: -18, y: -32, rotate: -25 },
  { x: 18, y: -32, rotate: 25 },
];

export default function CandidateCard({
  id,
  name,
  budget,
  description,
  totalLikes,
  likedByMe,
  comments,
  isSelectedForRoulette,
  onVote,
  onComment,
}: CandidateCardProps) {
  const [bursts, setBursts] = useState<number[]>([]);
  const [heartKey, setHeartKey] = useState(0);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleHeartPress = () => {
    // Always animate (every tap)
    const burstId = Date.now();
    setBursts((prev) => [...prev, burstId]);
    setHeartKey((k) => k + 1);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b !== burstId)), 700);

    // Vote toggles
    onVote(id);
  };

  const handleSendComment = () => {
    const text = commentText.trim();
    if (!text) return;
    onComment(id, text);
    setCommentText("");
  };

  return (
    <div
      className={`relative bg-white/90 backdrop-blur-sm rounded-3xl p-4 shadow-md transition-all duration-300 ${
        isSelectedForRoulette
          ? "border-2 border-yellow-400 animate-gold-pulse"
          : "border-2 border-transparent"
      }`}
    >
      {/* Roulette selected badge */}
      {isSelectedForRoulette && (
        <div className="absolute -top-2.5 -right-2.5 bg-yellow-400 rounded-full p-1.5 shadow-md">
          <Crown size={12} className="text-white" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-extrabold text-gray-800 text-base truncate">{name}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 shrink-0">
              {budget}
            </span>
          </div>
          <p className="text-gray-500 text-xs leading-relaxed">{description}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {/* Heart button */}
          <div className="relative flex flex-col items-center">
            <button
              key={heartKey}
              onClick={handleHeartPress}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-colors animate-heart-pop ${
                likedByMe
                  ? "bg-rose-100 text-rose-500"
                  : "bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-400"
              }`}
            >
              {likedByMe ? "❤️" : "🤍"}
            </button>
            {totalLikes > 0 && (
              <span className="text-xs font-extrabold text-rose-500">{totalLikes}</span>
            )}

            {/* Burst particles */}
            <AnimatePresence>
              {bursts.map((burstId) => (
                <div
                  key={burstId}
                  className="absolute inset-0 pointer-events-none flex items-center justify-center"
                >
                  {BURST_PATHS.map((path, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-xs"
                      initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
                      animate={{
                        opacity: 0,
                        x: path.x,
                        y: path.y,
                        scale: 0.4,
                        rotate: path.rotate,
                      }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                    >
                      ❤️
                    </motion.span>
                  ))}
                </div>
              ))}
            </AnimatePresence>
          </div>

          {/* Comment toggle */}
          <button
            onClick={() => {
              setShowComment((v) => !v);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-400 transition-colors"
          >
            <MessageCircle size={16} />
          </button>
        </div>
      </div>

      {/* Comments list */}
      <AnimatePresence>
        {comments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1 overflow-hidden"
          >
            {comments.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-start gap-1.5"
              >
                <span className="text-xs font-extrabold text-orange-400 shrink-0">
                  {c.nickname}:
                </span>
                <span className="text-xs text-gray-500 leading-relaxed">{c.text}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comment input */}
      <AnimatePresence>
        {showComment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex gap-2 overflow-hidden"
          >
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
              placeholder="一言コメント..."
              maxLength={40}
              className="flex-1 px-3 py-2 rounded-xl border-2 border-blue-100 bg-blue-50 text-gray-700 font-bold placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:border-blue-300 text-xs"
            />
            <button
              onClick={handleSendComment}
              disabled={!commentText.trim()}
              className="w-9 h-9 rounded-xl bg-blue-400 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            >
              <Send size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
