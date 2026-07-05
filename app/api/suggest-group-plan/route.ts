import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface CandidateResult {
  name: string;
  description: string;
  budget: string;
  reason: string;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  const { roomId, tags } = body as { roomId: string; tags: string[] };
  if (!roomId) {
    return NextResponse.json({ error: "roomId が必要です" }, { status: 400 });
  }

  const tagText = tags.length > 0
    ? tags.join("、")
    : "楽しい、みんなで、気軽に楽しめる";

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
あなたは日本の遊びスポット提案AIです。
グループの投票結果をもとに、おすすめのスポット・アクティビティを3〜4件提案してください。

グループが選んだ希望タグ: ${tagText}

ルール:
- タグの雰囲気に合った実在する施設・スポットやアクティビティを提案
- "name" は10文字以内の短い名称（例:「猫カフェ」「カラオケ」「映画館」）
- "budget" は「約○○円」の形式で実際の相場を記載
- "description" は40文字以内でスポットの特徴を説明
- "reason" は30文字以内でタグとの関連性を記載
- 3〜4件のみ返すこと
- JSONのみ出力し、余計な説明は不要

出力形式:
{
  "candidates": [
    {
      "name": "スポット名",
      "budget": "約○○円",
      "description": "説明",
      "reason": "理由"
    }
  ]
}
`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const text = result.text ?? "";
      const data = JSON.parse(text) as { candidates: CandidateResult[] };

      if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
        throw new Error("不正なレスポンス形式");
      }

      const candidates = data.candidates.slice(0, 4).map((c) => ({
        room_id: roomId,
        name: c.name.slice(0, 10),
        description: c.description,
        budget: c.budget,
        reason: c.reason,
      }));

      const supabase = getSupabase();
      if (!supabase) {
        return NextResponse.json({ error: "Supabase が設定されていません" }, { status: 500 });
      }

      const { error: insertErr } = await supabase.from("room_candidates").insert(candidates);
      if (insertErr) {
        return NextResponse.json({ error: "候補の保存に失敗しました" }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      lastError = err;
      if ((err as { status?: number })?.status === 429) break;
    }
  }

  const is429 = (lastError as { status?: number })?.status === 429;
  return NextResponse.json(
    { error: is429 ? "AIの1日の利用上限に達しました。時間をおいてから再試行してください🙏" : "AI提案の生成に失敗しました。しばらく経ってから再試行してください。" },
    { status: is429 ? 429 : 502 }
  );
}
