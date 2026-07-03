import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export interface DayPlanSlot {
  timeSlot: string;
  spotName: string;
  description: string;
  duration: string;
}

export interface DayPlan {
  title: string;
  totalBudget: string;
  timeline: DayPlanSlot[];
  extraSpots?: { spotName: string; category: string; description: string }[];
}

function extractJson(text: string): string | null {
  const t = text.trim();
  if (t.startsWith("{")) return t;
  const block = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) return block[1].trim();
  const idx = t.indexOf("{");
  return idx !== -1 ? t.slice(idx) : null;
}

function getSlotConfig(departure: string): { labels: [string, string, string]; times: [string, string, string] } {
  const hour = parseInt(departure.split(":")[0], 10);
  const pad = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  if (hour < 11) return { labels: ["朝", "昼", "夜"],      times: [departure, pad(hour + 3), pad(hour + 7)] };
  if (hour < 14) return { labels: ["昼", "夕方", "夜"],    times: [departure, pad(hour + 3), pad(hour + 6)] };
  if (hour < 17) return { labels: ["午後", "夕方", "夜"],  times: [departure, pad(hour + 2), pad(hour + 5)] };
  if (hour < 20) return { labels: ["夕方", "夜", "夜遅め"], times: [departure, pad(hour + 2), pad(hour + 4)] };
  return             { labels: ["夜", "深夜", "締め"],      times: [departure, pad(hour + 1), pad(hour + 3)] };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません" }, { status: 500 });

  let body: { location?: string; budget?: string; theme?: string; departureTime?: string; people?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  const {
    location = "どこでも",
    budget = "〜5,000円",
    theme = "なんでも",
    departureTime = "10:00",
    people = "2人",
  } = body;

  const { labels, times } = getSlotConfig(departureTime);

  const prompt = `あなたは遊びの予定をコーディネートするAI「Plan-co」です。以下の条件で最高の1日お出かけルートを提案してください。

条件: エリア=${location} / 人数=${people} / 予算(1人あたり合計)=${budget} / テーマ=${theme} / 出発=${departureTime}

以下のJSON形式のみを返してください。マークダウンコードブロック禁止。前後にテキスト不可。

{"title":"20文字以内のタイトル","totalBudget":"総予算目安","timeline":[{"timeSlot":"${labels[0]} (${times[0]}〜)","spotName":"15文字以内","description":"60文字以内","duration":"滞在時間目安"},{"timeSlot":"${labels[1]} (${times[1]}〜)","spotName":"15文字以内","description":"60文字以内","duration":"滞在時間目安"},{"timeSlot":"${labels[2]} (${times[2]}〜)","spotName":"15文字以内","description":"60文字以内","duration":"滞在時間目安"}],"extraSpots":[{"spotName":"10文字以内","category":"カテゴリ","description":"40文字以内"},{"spotName":"10文字以内","category":"カテゴリ","description":"40文字以内"},{"spotName":"10文字以内","category":"カテゴリ","description":"40文字以内"}]}`;

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const raw = res.text ?? "";
      const jsonStr = extractJson(raw);
      if (!jsonStr) throw new Error("JSON not found in response");
      const data = JSON.parse(jsonStr) as DayPlan;
      if (!data.title || !Array.isArray(data.timeline)) throw new Error("Invalid shape");
      return NextResponse.json({ plan: data });
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.error("Day plan error:", lastError);
  return NextResponse.json({ error: "1日プランの生成に失敗しました" }, { status: 502 });
}
