"use client";

import { useState } from "react";

type BriefingGeneratorProps = {
  policeStation: string;
};

type BriefingResponse = {
  briefing?: string;
  error?: string;
};

export default function BriefingGenerator({ policeStation }: BriefingGeneratorProps) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function generateBriefing() {
    if (briefing || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ policeStation }),
      });
      const payload = (await response.json()) as BriefingResponse;

      if (!response.ok || !payload.briefing) {
        throw new Error(
          payload.error ||
            "The briefing service is temporarily unavailable. Try again in a minute.",
        );
      }

      setBriefing(payload.briefing);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The briefing service is temporarily unavailable. Try again in a minute.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Daily briefing</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Generate a short operational note from this station&apos;s current ranking
            and weekly detail data.
          </p>
        </div>
        <button
          className="min-h-11 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isLoading || Boolean(briefing)}
          onClick={generateBriefing}
          type="button"
        >
          {isLoading
            ? "Generating..."
            : briefing
              ? "Briefing generated"
              : "Generate today's briefing"}
        </button>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          Generating briefing from the latest station ranking and weekly detail data.
        </div>
      ) : null}

      {briefing ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-950">
          {briefing}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          {error}
        </div>
      ) : null}
    </section>
  );
}
