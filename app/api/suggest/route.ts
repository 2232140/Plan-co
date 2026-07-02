import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { Suggestion } from "@/types/planco";

interface WeatherData {
  weather_code: number;
  temperature_2m: number;
  wind_speed_10m: number;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m,wind_speed_10m`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.current as WeatherData;
  } catch {
    return null;
  }
}

function buildWeatherRules(weather: WeatherData): string {
  const rules: string[] = [];
  const { weather_code, temperature_2m, wind_speed_10m } = weather;

  const isRain =
    (weather_code >= 51 && weather_code <= 67) ||
    (weather_code >= 80 && weather_code <= 82) ||
    weather_code >= 95;
  const isSnow =
    (weather_code >= 71 && weather_code <= 77) ||
    weather_code === 85 ||
    weather_code === 86;

  if (isRain || isSnow) {
    const precip = isSnow ? "雪" : "雨";
    rules.push(
      `【屋内優先・移動最小化】現在${precip}が降っています。提案の90%以上を屋内施設（美術館・映画館・カフェ・屋内アミューズメントなど）にし、最寄り駅から徒歩5分以内または地下道直結のスポットを最優先してください。`
    );
  }

  if (wind_speed_10m >= 15) {
    rules.push(
      `【強風回避】現在の風速は${wind_speed_10m.toFixed(1)}km/hです。屋外の展望台・水上アクティビティ・屋外テーマパークは避け、風の入りにくい屋内スポットや商業施設を優先してください。`
    );
  }

  if (temperature_2m >= 33) {
    rules.push(
      `【猛暑対策】現在の気温は${temperature_2m.toFixed(1)}℃です。エアコンの効いた屋内スポットを提案し、屋外の長時間移動や行列スポットは避けてください。かき氷・アクアリウムなど涼感のあるプランを含めてください。`
    );
  } else if (temperature_2m <= 8) {
    rules.push(
      `【極寒対策】現在の気温は${temperature_2m.toFixed(1)}℃です。外で長時間並ぶスポットを避け、温かいグルメ（ラーメン・鍋・スープカレー）や温泉・スパ・暖房の効いた屋内エンタメを優先してください。`
    );
  }

  const hour = new Date().getHours();
  if (hour >= 18) {
    rules.push(
      `【夜間優先】現在は夜（${hour}時）です。夜景スポット・バー・夜間営業カフェ・ディナー向けの場所を優先し、昼間のみ開いている公園などは避けてください。`
    );
  }

  if (rules.length === 0) return "";
  return `\n\n【環境最適化ルール（必ず守ること）】\n${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
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

  const { peopleCount, budget, theme, location, lat, lon } = body as {
    peopleCount: string;
    budget: string;
    theme: string;
    location: string;
    lat?: number;
    lon?: number;
  };

  // 天気データ取得（座標がある場合のみ）
  let weatherRules = "";
  if (typeof lat === "number" && typeof lon === "number") {
    const weather = await fetchWeather(lat, lon);
    if (weather) {
      weatherRules = buildWeatherRules(weather);
    }
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
あなたは日本の遊びスポット提案AIです。
以下の条件に合う実在する施設・スポットやアクティビティを5件提案してください。

条件:
- 人数: ${peopleCount}
- 予算（1人あたり）: ${budget}
- テーマ: ${theme}
- エリア: ${location || "日本全国（都市部）"}${weatherRules}

ルール:
- "name" はルーレットに収まる10文字以内の短い名称にすること（例: 「猫カフェ」「カラオケ」「映画館」）
- "budget" は「約○○円」の形式で実際の相場を記載
- "description" は40文字以内でスポットの特徴を説明
- "reason" は30文字以内でなぜおすすめかを記載
- 5件のみ返すこと
- JSONのみ出力し、余計な説明は不要

出力形式:
{
  "suggestions": [
    {
      "id": "1",
      "name": "スポット名",
      "budget": "約○○円",
      "description": "説明文",
      "reason": "おすすめ理由"
    }
  ]
}
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = result.text ?? "";
    const data = JSON.parse(text) as { suggestions: Suggestion[] };

    if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
      throw new Error("不正なレスポンス形式");
    }

    data.suggestions = data.suggestions.slice(0, 5).map((s, i) => ({
      ...s,
      id: String(i + 1),
      name: s.name.slice(0, 10),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("Gemini API error:", err);
    return NextResponse.json(
      { error: "AI提案の生成に失敗しました。しばらく経ってから再試行してください。" },
      { status: 502 }
    );
  }
}
