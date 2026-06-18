"use client";

import { FormEvent, useState } from "react";

type ZoneQuestionAssistantProps = {
  policeStation: string;
};

type ZoneQuestionResponse = {
  answer?: string;
  error?: string;
};

export default function ZoneQuestionAssistant({
  policeStation,
}: ZoneQuestionAssistantProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isLoading) {
      return;
    }

    setIsLoading(true);
    setAnswer(null);
    setError(null);

    try {
      const response = await fetch("/api/zone-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          policeStation,
          question: trimmedQuestion,
        }),
      });
      const payload = (await response.json()) as ZoneQuestionResponse;

      if (!response.ok || !payload.answer) {
        throw new Error(
          payload.error ||
            "The question service is temporarily unavailable. Try again in a minute.",
        );
      }

      setAnswer(payload.answer);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The question service is temporarily unavailable. Try again in a minute.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-950">Ask about this zone</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Ask a short operational question. Answers are limited to the available
          station detail data.
        </p>
      </div>

      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={askQuestion}>
        <input
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          disabled={isLoading}
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What should we focus on here?"
          type="text"
          value={question}
        />
        <button
          className="min-h-11 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isLoading || question.trim().length === 0}
          type="submit"
        >
          {isLoading ? "Asking..." : "Ask"}
        </button>
      </form>

      {isLoading ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          Checking the question against this zone&apos;s available detail data.
        </div>
      ) : null}

      {answer ? (
        <div className="mt-5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-800">
          {answer}
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
