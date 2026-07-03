"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Suggestion, DayPlan, DayPlanSlot } from "@/types/planco";

interface TextMessage { role: "user" | "ai"; text: string; }
interface PlanMessage { role: "plan-result"; plan: DayPlan; }
type Message = TextMessage | PlanMessage;
type HistoryEntry = { role: "user" | "model"; parts: [{ text: string }] };
type ChatMode = "initial" | "place" | "plan";

const SLOT_COLORS = ["#FFB5A7", "#B5EAD7", "#C7CEEA"];
const SLOT_BG    = ["bg-rose-50", "bg-emerald-50", "bg-purple-50"];
const SLOT_TEXT  = ["text-rose-500", "text-emerald-500", "text-purple-500"];

function extractJson(text: string): string | null {
  const t = text.trim();
  if (t.startsWith("{")) return t;
  const block = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) return block[1].trim();
  const idx = t.indexOf("{");
  return idx !== -1 ? t.slice(idx) : null;
}

function parseSuggestions(text: string): Suggestion[] | null {
  const jsonStr = extractJson(text);
  if (!jsonStr) return null;
  try {
    const data = JSON.parse(jsonStr) as { mode: string; suggestions: Suggestion[] };
    if (data.mode === "suggest" && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions.slice(0, 5).map((s, i) => ({ ...s, id: String(i + 1), name: s.name.slice(0, 10) }));
    }
  } catch {}
  return null;
}

function parseDayPlan(text: string): DayPlan | null {
  const jsonStr = extractJson(text);
  if (!jsonStr) return null;
  try {
    const data = JSON.parse(jsonStr) as { mode: string; plan: DayPlan };
    if (data.mode === "dayplan" && data.plan?.timeline) return data.plan;
  } catch {}
  return null;
}

function DayPlanCard({ plan }: { plan: DayPlan }) {
  return (
    <div className="space-y-2 w-full">
      <div className="text-center mb-3">
        <p className="text-xs font-bold text-orange-400 tracking-widest">📅 1日プラン完成！</p>
        <p className="font-extrabold text-gray-800 text-base leading-tight mt-1">{plan.title}</p>
        <p className="text-gray-400 text-xs mt-0.5">総予算: {plan.totalBudget}</p>
      </div>
      {plan.timeline.map((slot: DayPlanSlot, i: number) => (
        <div key={i} className={`rounded-2xl p-3 ${SLOT_BG[i]}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-extrabold shrink-0"
              style={{ backgroundColor: SLOT_COLORS[i] }}>
              {["朝","昼","夜"][i]}
            </div>
            <p className={`text-xs font-bold ${SLOT_TEXT[i]}`}>{slot.timeSlot}</p>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${SLOT_BG[i]} ${SLOT_TEXT[i]} border border-current/20`}>
              {slot.duration}
            </span>
          </div>
          <p className="font-extrabold text-gray-800 text-sm pl-8">{slot.spotName}</p>
          <p className="text-gray-500 text-xs leading-relaxed pl-8 mt-0.5">{slot.description}</p>
        </div>
      ))}
    </div>
  );
}

export default function AIChatTab() {
  const router = useRouter();
  const [chatMode, setChatMode] = useState<ChatMode>("initial");
  const [messages, setMessages]   = useState<Message[]>([]);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [input, setInput]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [dayPlan, setDayPlan]     = useState<DayPlan | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const startMode = (mode: "place" | "plan") => {
    setChatMode(mode);
    const greeting: TextMessage = mode === "place"
      ? { role: "ai", text: "こんにちは！ぷらんちゃんです🌸 今日はどこで遊ぶか一緒に考えましょう！\nどんなエリアで、誰と行く予定ですか？" }
      : { role: "ai", text: "1日プランを考えるね📅✨ どのエリアで遊ぶ予定？\nあと、何人くらいで行くか教えて！" };
    setMessages([greeting]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    const userMsg: TextMessage = { role: "user", text };
    setMessages((p) => [...p, userMsg]);
    setIsLoading(true);
    const newHistory: HistoryEntry[] = [...history, { role: "user", parts: [{ text }] }];
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: text, chatMode }),
      });
      if (!res.ok) throw new Error("AI応答エラー");
      const data = await res.json() as { text: string };
      const aiText = data.text;

      if (chatMode === "plan") {
        const plan = parseDayPlan(aiText);
        if (plan) {
          setDayPlan(plan);
          const planMsg: PlanMessage = { role: "plan-result", plan };
          setMessages((p) => [...p, planMsg]);
        } else {
          setMessages((p) => [...p, { role: "ai", text: aiText }]);
        }
      } else {
        const parsed = parseSuggestions(aiText);
        if (parsed) {
          setSuggestions(parsed);
          setMessages((p) => [...p, { role: "ai", text: "✨ プランが揃いました！下のボタンから確認してね🎉" }]);
        } else {
          setMessages((p) => [...p, { role: "ai", text: aiText }]);
        }
      }
      setHistory([...newHistory, { role: "model", parts: [{ text: aiText }] }]);
    } catch {
      setMessages((p) => [...p, { role: "ai", text: "ごめんね、うまく返事できなかった💦 もう一度試してみて！" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSuggestions = () => {
    if (!suggestions) return;
    sessionStorage.setItem("planco_suggestions", JSON.stringify(suggestions));
    sessionStorage.setItem("planco_location", "チャットで取得");
    sessionStorage.setItem("planco_solo_mode", "true");
    router.push("/suggestions");
  };

  const isDone = !!suggestions || !!dayPlan;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 140px)" }}>
      {/* Initial mode selection */}
      {chatMode === "initial" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="text-center">
            <div className="text-4xl mb-2">🌸</div>
            <p className="font-extrabold text-white text-xl drop-shadow-md">ぷらんちゃんです！</p>
            <p className="text-white/80 text-sm mt-1">今日はどっちを決める？</p>
          </div>
          <div className="w-full space-y-3">
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => startMode("place")}
              className="w-full rounded-3xl p-5 text-left shadow-xl"
              style={{ background: "linear-gradient(135deg, #ffffff 0%, #fff0f0 100%)" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                  style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
                  📍
                </div>
                <div>
                  <p className="font-extrabold text-gray-800 text-lg">場所を決める</p>
                  <p className="text-gray-400 text-xs mt-0.5">5つの候補 → ルーレットで決定！</p>
                </div>
              </div>
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => startMode("plan")}
              className="w-full rounded-3xl p-5 text-left shadow-xl"
              style={{ background: "linear-gradient(135deg, #e8f4ff 0%, #f0e8ff 100%)" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                  style={{ background: "linear-gradient(135deg, #C7CEEA 0%, #B5EAD7 100%)" }}>
                  📅
                </div>
                <div>
                  <p className="font-extrabold text-gray-800 text-lg">1日プランを決める</p>
                  <p className="text-gray-400 text-xs mt-0.5">朝・昼・夜の充実プランを提案！</p>
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* Chat area */}
      {chatMode !== "initial" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                if (msg.role === "plan-result") {
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                      className="flex justify-start">
                      <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">🌸</div>
                      <div className="max-w-[85%] bg-white/90 rounded-2xl rounded-tl-sm p-4 shadow-sm">
                        <DayPlanCard plan={msg.plan} />
                      </div>
                    </motion.div>
                  );
                }
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">🌸</div>
                    )}
                    <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm font-bold leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user" ? "bg-orange-400 text-white rounded-tr-sm" : "bg-white/90 text-gray-700 rounded-tl-sm shadow-sm"}`}>
                      {msg.text}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm mr-2 shrink-0">🌸</div>
                <div className="bg-white/90 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-orange-300 animate-dot-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Bottom bar */}
          <div className="shrink-0 px-4 pb-6 pt-3"
            style={{ background: "linear-gradient(to top, #FEC89A 80%, transparent)" }}>
            {suggestions && (
              <motion.button initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                onClick={handleViewSuggestions}
                className="w-full py-3 mb-2 rounded-2xl font-extrabold text-white text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
                <Sparkles size={20} />AIが提案したプランを見る！
              </motion.button>
            )}
            {!isDone && (
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 300)}
                  placeholder="メッセージを入力..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-2xl bg-white/90 text-gray-700 font-bold placeholder:text-gray-300 placeholder:font-normal focus:outline-none text-sm disabled:opacity-50" />
                <button onClick={handleSend} disabled={isLoading || !input.trim()}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}>
                  {isLoading ? <Loader2 size={18} className="text-white animate-spin" /> : <Send size={18} className="text-white" />}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
