"use client";

import Link from "next/link";
import type { StationRanking } from "@/lib/types";

type PriorityListProps = {
  rankings: StationRanking[];
  selectedStation: string | null;
  onSelectStation: (policeStation: string) => void;
};

type ScoreBreakdownItem = {
  label: string;
  value: number;
};

function getPriorityTone(score: number) {
  if (score >= 75) {
    return {
      label: "High",
      dotClass: "bg-red-500",
      scoreClass: "text-red-700",
      badgeClass: "bg-red-50 text-red-700 ring-red-200",
    };
  }

  if (score >= 45) {
    return {
      label: "Medium",
      dotClass: "bg-amber-500",
      scoreClass: "text-amber-700",
      badgeClass: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  return {
    label: "Low",
    dotClass: "bg-emerald-500",
    scoreClass: "text-emerald-700",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
}

function ScoreBar({ label, value }: ScoreBreakdownItem) {
  return (
    <div className="min-w-0">
      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-xs font-medium text-slate-500">
        <span className="truncate">{label}</span>
        <span className="text-right tabular-nums text-slate-700">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-700"
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

export default function PriorityList({
  rankings,
  selectedStation,
  onSelectStation,
}: PriorityListProps) {
  if (rankings.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
        No station rankings are available yet.
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label="Police-station priority rankings">
      {rankings.map((station) => {
        const tone = getPriorityTone(station.priorityScore);
        const breakdown: ScoreBreakdownItem[] = [
          { label: "Density", value: station.violationDensityScore },
          { label: "Closure", value: station.closureRiskScore },
          { label: "Trend", value: station.trendScore },
        ];
        const isSelected = selectedStation === station.policeStation;

        return (
          <Link
            className={`group grid gap-5 rounded-lg border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md md:grid-cols-[3.5rem_minmax(0,1fr)_6.5rem] md:items-center xl:grid-cols-[4rem_minmax(0,1fr)_7.5rem_minmax(12rem,15rem)] ${
              isSelected
                ? "border-slate-950 ring-2 ring-slate-950/10"
                : "border-slate-200"
            }`}
            href={`/station/${encodeURIComponent(station.policeStation)}`}
            key={station.policeStation}
            onFocus={() => onSelectStation(station.policeStation)}
            onMouseEnter={() => onSelectStation(station.policeStation)}
          >
            <div className="flex items-center gap-3 md:block">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Rank
              </div>
              <div className="text-2xl font-semibold tabular-nums text-slate-950">
                {station.rank}
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug text-slate-950">
                {station.policeStation}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {station.violationCountLastWeek.toLocaleString("en-IN")} violations last week
              </p>
            </div>

            <div className="flex items-center gap-3 md:justify-end">
              <span className={`h-3 w-3 rounded-full ${tone.dotClass}`} />
              <div>
                <div className={`text-3xl font-semibold tabular-nums ${tone.scoreClass}`}>
                  {station.priorityScore.toFixed(1)}
                </div>
                <div
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.badgeClass}`}
                >
                  {tone.label}
                </div>
              </div>
            </div>

            <div className="min-w-0 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {breakdown.map((item) => (
                <ScoreBar key={item.label} {...item} />
              ))}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
