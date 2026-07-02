"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Content } from "@google/genai";
import { Suggestion } from "@/types/planco";

interface Message {
  role: "user" | "ai";
  text: string;
}

const INITIAL_MESSAGE: Message = {
  role: "ai",
  text: "こんにちは！ぷらんちゃんです🌸 今日はどこで遊ぶか一緒に考えましょう！\nどんなエリアで、誰と行く予定ですか？",
};

function parseSuggestions(text: string): Suggestion[] | null {
  try {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) return null;
    const data = JSON.parse(trimmed) as { mode: string; suggestions: Suggestion[] };
    if (data.mode === "suggest" && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions.slice(0, 5).map((s, i) => ({
        ...s,
        id: String(i + 1),
        name: s.name.slice(0, 10),
      }));
    }
  } catch {}
  return null;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [history, setHistory] = useState<Content[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    const userMessage: Message = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const newHistory: Content[] = [
      ...history,
      { role: "user", parts: [{ text }] },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: text }),
      });
      if (!res.ok) throw new Error("AI応答エラー");
      const data = await res.json() as { text: string };
      const aiText = data.text;

      const parsed = parseSuggestions(aiText);
      if (parsed) {
        setSuggestions(parsed);
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "✨ プランが揃いました！下のボタンから確認してね🎉" },
        ]);
        setHistory([
          ...newHistory,
          { role: "model", parts: [{ text: aiText }] },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: aiText }]);
        setHistory([
          ...newHistory,
          { role: "model", parts: [{ text: aiText }] },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "ごめんね、うまく返事できなかった💦 もう一度試してみて！" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSuggestions = () => {
    if (!suggestions) return;
    sessionStorage.setItem("planco_suggestions", JSON.stringify(suggestions));
    sessionStorage.setItem("planco_location", "チャットで取得");
    router.push("/suggestions");
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
    >
      {/* Header */}
      <header className="flex items-center px-4 pt-6 pb-3 max-w-md mx-auto w-full">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-full bg-white/30 hover:bg-white/50 transition-colors active:scale-95"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="flex-1 text-center pr-9">
          <h1 className="text-xl font-extrabold text-white drop-shadow-md">
            ぷらんちゃんに相談 💬
          </h1>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-md mx-auto w-full space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">
                  🌸
                </div>
              )}
              <div
                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm font-bold leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-orange-400 text-white rounded-tr-sm"
                    : "bg-white/90 text-gray-700 rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm mr-2 shrink-0">
              🌸
            </div>
            <div className="bg-white/90 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-orange-300 animate-dot-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion CTA */}
      {suggestions && (
        <div className="px-4 pb-3 max-w-md mx-auto w-full">
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleViewSuggestions}
            className="w-full py-4 rounded-2xl font-extrabold text-white text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
          >
            <Sparkles size={20} />
            AIが提案したプランを見る！
          </motion.button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-6 pt-2 max-w-md mx-auto w-full">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="メッセージを入力..."
            disabled={isLoading || !!suggestions}
            className="flex-1 px-4 py-3 rounded-2xl bg-white/90 text-gray-700 font-bold placeholder:text-gray-300 placeholder:font-normal focus:outline-none text-sm disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !!suggestions}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
          >
            {isLoading ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <Send size={18} className="text-white" />
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
