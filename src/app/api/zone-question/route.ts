import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getStationDetail, getStationRankings } from "@/lib/data";
import type { StationRanking } from "@/lib/types";

export const runtime = "nodejs";

type ZoneQuestionRequest = {
  policeStation?: string;
  question?: string;
};

type GeminiResponse = Awaited<
  ReturnType<GoogleGenAI["models"]["generateContent"]>
>;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  for (const candidate of ["status", "statusCode", "code"] as const) {
    const value = (error as Record<string, unknown>)[candidate];

    if (typeof value === "number" || typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function isRetryableGeminiError(error: unknown) {
  const status = getErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error);

  return status === 503 || status === "503" || message.includes("UNAVAILABLE");
}

function findStationRanking(
  rankings: StationRanking[],
  policeStation: string,
): StationRanking | undefined {
  return rankings.find(
    (ranking) => ranking.policeStation.toLowerCase() === policeStation.toLowerCase(),
  );
}

async function generateAnswerWithRetry(ai: GoogleGenAI, prompt: string) {
  const retryDelays = [1000, 1800];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 300,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error) || attempt === retryDelays.length) {
        throw error;
      }

      await sleep(retryDelays[attempt]);
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key is not configured on the server." },
      { status: 503 },
    );
  }

  let body: ZoneQuestionRequest;

  try {
    body = (await request.json()) as ZoneQuestionRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const policeStation = body.policeStation?.trim();
  const question = body.question?.trim();

  if (!policeStation) {
    return NextResponse.json({ error: "policeStation is required." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json(
      { error: "Question must be 500 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const rankings = getStationRankings();
    const ranking = findStationRanking(rankings, policeStation);

    if (!ranking) {
      return NextResponse.json(
        { error: `No ranking found for police station: ${policeStation}` },
        { status: 404 },
      );
    }

    const detail = getStationDetail(ranking.policeStation);
    const stationContext = {
      policeStation: ranking.policeStation,
      ranking,
      stationDetail: detail,
    };
    const prompt = `
Answer the commander's question using only the station data provided below.
If the question asks for something not present in the data, say that the provided data does not contain enough information to answer it. Do not guess, infer unstated causes, invent time-of-day patterns, or compare to periods that are not represented in the data.
Keep the answer short, plain text, and operational. Do not use markdown formatting.

Station data JSON:
${JSON.stringify(stationContext)}

Question:
${question}
`;

    const ai = new GoogleGenAI({ apiKey });
    const response: GeminiResponse = await generateAnswerWithRetry(ai, prompt);
    const answer = response.text?.trim();

    if (!answer) {
      return NextResponse.json(
        { error: "Gemini returned an empty answer." },
        { status: 502 },
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to answer question.";
    const cause = error instanceof Error ? error.cause : undefined;

    console.error("Zone question failed", {
      name: error instanceof Error ? error.name : undefined,
      message,
      stack: error instanceof Error ? error.stack : undefined,
      cause,
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
