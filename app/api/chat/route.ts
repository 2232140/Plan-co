import { GoogleGenAI, Content } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `
あなたはPlan-coのAIアシスタント「ぷらんちゃん」です。絵文字を使って友達のような軽いトーンで話してください。

【会話フェーズ】
以下の情報を自然な会話で引き出してください（全部揃わなくてもOK）：
- どのエリアで遊びたいか
- 何人で行くか
- 1人あたりの予算
- テーマや雰囲気（「少し騒がしくてもOK」「おしゃれな感じ」「冒険したい」などの"わがまま"も大歓迎）

一度に全部聞かず、会話の流れで自然に引き出してください。最初のメッセージは軽く挨拶して1〜2個だけ聞いてください。

【提案フェーズへの切り替え条件】
以下のいずれかの場合に提案フェーズへ移行してください：
- ユーザーが「決めて」「提案して」「お願い」「もうOK」などと言った場合
- 3〜4ターンの会話でエリアとテーマが把握できた場合

【提案フェーズ】
提案フェーズに入ったら、以下のJSON形式のみを返してください（前後にテキストを絶対に付けないこと）：
{"mode":"suggest","suggestions":[{"id":"1","name":"10文字以内の名称","budget":"約○○円","description":"40文字以内の説明","reason":"30文字以内の理由"},{"id":"2","name":"...","budget":"...","description":"...","reason":"..."},{"id":"3","name":"...","budget":"...","description":"...","reason":"..."},{"id":"4","name":"...","budget":"...","description":"...","reason":"..."},{"id":"5","name":"...","budget":"...","description":"...","reason":"..."}]}

必ず5件提案し、JSONのみ返してください。
`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません" }, { status: 500 });
  }

  let body: { history?: Content[]; message: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  const { history, message } = body;

  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: { systemInstruction: SYSTEM_INSTRUCTION },
    history: history ?? [],
  });

  try {
    const response = await chat.sendMessage({ message });
    const text = response.text ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "AI応答の生成に失敗しました" }, { status: 502 });
  }
}
