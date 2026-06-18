import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getStationDetail, getStationRankings } from "@/lib/data";
import type { StationRanking } from "@/lib/types";

export const runtime = "nodejs";

type BriefingRequest = {
  policeStation?: string;
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

  const candidates = [
    "status",
    "statusCode",
    "code",
  ] as const;

  for (const candidate of candidates) {
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

async function generateBriefingWithRetry(ai: GoogleGenAI, prompt: string) {
  const retryDelays = [1000, 1800];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 500,
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

function findStationRanking(
  rankings: StationRanking[],
  policeStation: string,
): StationRanking | undefined {
  return rankings.find(
    (ranking) => ranking.policeStation.toLowerCase() === policeStation.toLowerCase(),
  );
}

function formatTrendPercentage(current: number, previous: number | undefined) {
  if (!previous) {
    return "not available because the previous week count is zero or missing";
  }

  const trendPercentage = ((current - previous) / previous) * 100;
  const direction = trendPercentage >= 0 ? "increase" : "decrease";

  return `${Math.abs(trendPercentage).toFixed(1)}% ${direction} from the previous week`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key is not configured on the server." },
      { status: 503 },
    );
  }

  let body: BriefingRequest;

  try {
    body = (await request.json()) as BriefingRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const policeStation = body.policeStation?.trim();

  if (!policeStation) {
    return NextResponse.json(
      { error: "policeStation is required." },
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
    const latestWeek = detail.weeklyTimeSeries.at(-1);
    const previousWeek = detail.weeklyTimeSeries.at(-2);

    if (!latestWeek) {
      return NextResponse.json(
        { error: `No weekly data found for police station: ${ranking.policeStation}` },
        { status: 404 },
      );
    }

    const topViolationTypes = detail.topViolationTypes
      .slice(0, 3)
      .map((item) => `${item.violationType}: ${item.count}`)
      .join("; ");
    const topVehicleTypes = detail.topVehicleTypes
      .slice(0, 3)
      .map((item) => `${item.vehicleType}: ${item.count}`)
      .join("; ");
    const topJunctions =
      detail.topJunctions.length > 0
        ? detail.topJunctions
            .slice(0, 3)
            .map((item) => `${item.junctionName}: ${item.count}`)
            .join("; ")
        : "No specific junction concentration provided";

    const prompt = `
Write a 3 to 5 sentence operational briefing for a traffic police commander.
Ground every specific claim only in the numbers provided below. Never invent a statistic, location, percentage, or cause that is not listed here.
If you mention more than one violation count, explicitly label each count with its time window, such as "last week" or "week ${latestWeek.week}", so the numbers cannot be mistaken for the same period.
Recommend one concrete enforcement action, including where to focus patrol attention and what kind of violation to prioritize.
Write in plain operational language, not marketing language.
Do not include any disclaimer about being an AI, model limitations, or unavailable context. Just write the briefing.

Station: ${ranking.policeStation}
Current rank: ${ranking.rank}
Overall priority score: ${ranking.priorityScore}
Last week's violation count from ranking artifact: ${ranking.violationCountLastWeek}
Latest weekly time-series point: week ${latestWeek.week}, violation count for week ${latestWeek.week} ${latestWeek.violationCount}, closure count for week ${latestWeek.week} ${latestWeek.closureCount}
Week-over-week violation trend: ${formatTrendPercentage(
      latestWeek.violationCount,
      previousWeek?.violationCount,
    )}
Trend score: ${ranking.trendScore}
Closure risk score: ${ranking.closureRiskScore}
Violation density score: ${ranking.violationDensityScore}
Top violation subtypes: ${topViolationTypes || "None provided"}
Top vehicle types: ${topVehicleTypes || "None provided"}
Most affected junctions: ${topJunctions}
`;

    const ai = new GoogleGenAI({ apiKey });
    const response: GeminiResponse = await generateBriefingWithRetry(ai, prompt);

    const rawBriefing = response.text;
    console.log("Raw Gemini briefing response text:", rawBriefing);

    const briefing = rawBriefing?.trim();

    if (!briefing) {
      return NextResponse.json(
        { error: "Gemini returned an empty briefing." },
        { status: 502 },
      );
    }

    return NextResponse.json({ briefing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate briefing.";
    const cause = error instanceof Error ? error.cause : undefined;

    console.error("Briefing generation failed", {
      name: error instanceof Error ? error.name : undefined,
      message,
      stack: error instanceof Error ? error.stack : undefined,
      cause,
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
