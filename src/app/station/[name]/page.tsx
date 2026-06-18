import Link from "next/link";
import { notFound } from "next/navigation";
import BriefingGenerator from "@/components/BriefingGenerator";
import CategoryBars from "@/components/CategoryBars";
import StationTrendChart from "@/components/StationTrendChart";
import ZoneQuestionAssistant from "@/components/ZoneQuestionAssistant";
import { getModelMetrics, getStationDetail, getStationRankings } from "@/lib/data";
import type { StationRanking } from "@/lib/types";

type StationPageProps = {
  params: Promise<{
    name: string;
  }>;
};

type ScoreComponent = {
  label: string;
  value: number;
};

export const dynamic = "force-dynamic";

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

function findStationRanking(
  rankings: StationRanking[],
  stationName: string,
): StationRanking | undefined {
  return rankings.find(
    (ranking) => ranking.policeStation.toLowerCase() === stationName.toLowerCase(),
  );
}

function scoreBreakdown(station: StationRanking): ScoreComponent[] {
  return [
    { label: "Violation density", value: station.violationDensityScore },
    { label: "Closure risk", value: station.closureRiskScore },
    { label: "Trend", value: station.trendScore },
  ];
}

export default async function StationPage({ params }: StationPageProps) {
  const { name } = await params;
  const stationName = decodeURIComponent(name);
  const rankings = getStationRankings();
  const ranking = findStationRanking(rankings, stationName);

  if (!ranking) {
    notFound();
  }

  const detail = getStationDetail(ranking.policeStation);
  const modelMetrics = getModelMetrics();
  const tone = getPriorityTone(ranking.priorityScore);
  const components = scoreBreakdown(ranking);
  const strongestComponent = [...components].sort((a, b) => b.value - a.value)[0];
  const topFeatures = modelMetrics.featureImportance.slice(0, 2);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10">
        <Link
          className="mb-5 inline-flex text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
          href="/"
        >
          Back to dashboard
        </Link>

        <header className="mb-6 rounded-lg bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
                Police-station zone
              </p>
              <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-5xl">
                {ranking.policeStation}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Current enforcement priority for this zone, based on recent parking
                violations, closure-risk signals, and week-over-week trend.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:min-w-64 md:grid-cols-1">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Rank
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-white">
                  #{ranking.rank}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${tone.dotClass}`} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.badgeClass}`}
                  >
                    {tone.label} priority
                  </span>
                </div>
                <div className="mt-2 text-4xl font-semibold tabular-nums text-white">
                  {ranking.priorityScore.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </header>

        <BriefingGenerator policeStation={ranking.policeStation} />
        <ZoneQuestionAssistant policeStation={ranking.policeStation} />

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-950">Weekly activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Violations and closure incidents over the full available time range.
            </p>
          </div>
          <StationTrendChart data={detail.weeklyTimeSeries} />
        </section>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-slate-950">Top vehicle types</h2>
            <CategoryBars
              items={detail.topVehicleTypes.map((item) => ({
                label: item.vehicleType,
                count: item.count,
              }))}
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-slate-950">
              Top violation types
            </h2>
            <CategoryBars
              items={detail.topViolationTypes.map((item) => ({
                label: item.violationType,
                count: item.count,
              }))}
            />
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {detail.topJunctions.length > 0 ? (
              <>
                <h2 className="mb-5 text-xl font-semibold text-slate-950">
                  Most affected junctions
                </h2>
                <ol className="space-y-3">
                  {detail.topJunctions.map((junction, index) => (
                    <li
                      className="grid grid-cols-[2rem_minmax(0,1fr)_4.5rem] items-start gap-3 rounded-lg bg-slate-50 p-3"
                      key={junction.junctionName}
                    >
                      <span className="font-semibold tabular-nums text-slate-400">
                        {index + 1}
                      </span>
                      <span className="break-words text-sm font-medium text-slate-700">
                        {junction.junctionName}
                      </span>
                      <span className="text-right text-sm tabular-nums text-slate-500">
                        {junction.count.toLocaleString("en-IN")}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Violations here are spread across general road segments rather than
                specific junctions.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-950">Why this score</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This zone&apos;s strongest component is{" "}
              <span className="font-semibold text-slate-950">
                {strongestComponent.label.toLowerCase()}
              </span>{" "}
              at {strongestComponent.value.toFixed(1)}. The ranking also reflects the
              model&apos;s strongest global signals:{" "}
              {topFeatures.map((feature) => feature.feature).join(" and ")}.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {components.map((component) => (
                <div className="rounded-lg bg-slate-50 p-4" key={component.label}>
                  <div className="text-sm font-medium text-slate-500">
                    {component.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                    {component.value.toFixed(1)}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-800"
                      style={{ width: `${Math.max(0, Math.min(component.value, 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {topFeatures.map((feature) => (
                <div
                  className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600"
                  key={feature.rawFeature}
                >
                  <span className="font-medium text-slate-950">{feature.feature}</span>
                  <span className="ml-2 tabular-nums">
                    {feature.importance.toFixed(1)} importance
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
