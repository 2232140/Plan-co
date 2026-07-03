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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません" }, { status: 500 });

  let body: {
    location?: string;
    budget?: string;
    theme?: string;
    departureTime?: string;
    people?: string;
  };
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

  const prompt = `あなたは遊びの予定をコーディネートするAI「Plan-co」です。以下の条件で、朝・昼・夜の3時間帯がつながりを持った最高の1日お出かけルートを提案してください。

条件: エリア=${location} / 人数=${people} / 予算(1人あたり合計)=${budget} / テーマ=${theme} / 出発=${departureTime}

以下のJSON形式のみを返してください。マークダウンコードブロック禁止。前後にテキスト不可。

{"title":"20文字以内のタイトル","totalBudget":"総予算目安","timeline":[{"timeSlot":"朝 (${departureTime}〜)","spotName":"15文字以内のスポット名","description":"60文字以内の説明","duration":"滞在時間目安"},{"timeSlot":"昼 (12:30〜)","spotName":"15文字以内のスポット名","description":"60文字以内の説明","duration":"滞在時間目安"},{"timeSlot":"夜 (17:00〜)","spotName":"15文字以内のスポット名","description":"60文字以内の説明","duration":"滞在時間目安"}],"extraSpots":[{"spotName":"10文字以内","category":"カテゴリ(例:カフェ/展望台/ショップ)","description":"40文字以内の説明"},{"spotName":"...","category":"...","description":"..."},{"spotName":"...","category":"...","description":"..."}]}`;

  const ai = new GoogleGenAI({ apiKey });
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
    console.error("Day plan error:", err);
    return NextResponse.json({ error: "1日プランの生成に失敗しました" }, { status: 502 });
  }
}
