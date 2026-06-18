import Link from "next/link";
import { getMethodologySummary } from "@/lib/data";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("en-IN");

function formatPercent(value: number) {
  return `${value}%`;
}

function formatMetric(value: number) {
  return value.toFixed(3);
}

export default function MethodologyPage() {
  const summary = getMethodologySummary();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-10">
        <header className="rounded-lg bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <Link
            href="/"
            className="text-sm font-medium text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white"
          >
            Back to dashboard
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
            GridSight methodology
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            How the priority ranking is built
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            This page describes what the system measures, how the score is
            assembled, what the model predicts, and where the method should not
            be over-interpreted.
          </p>
        </header>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Source Data</h2>
          <p className="leading-7 text-slate-700">
            GridSight uses two anonymized Bengaluru datasets: parking-violation
            records and Astram traffic-incident records. The cleaned data covers
            roughly five months, from November 2023 to April 2024, across{" "}
            {numberFormat.format(summary.stationCount)} police-station
            jurisdictions.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Cleaned parking-violation records
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {numberFormat.format(summary.parkingViolationRows)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Cleaned Astram traffic-incident records
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {numberFormat.format(summary.trafficIncidentRows)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Priority Score</h2>
          <p className="leading-7 text-slate-700">
            Each station receives a weekly priority score on a 0-100 scale. The
            score is a weighted blend of three station-level components:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Violation density
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {formatPercent(summary.priorityWeights.violationDensity)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Predicted closure risk
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {formatPercent(summary.priorityWeights.closureRisk)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Recent trend
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {formatPercent(summary.priorityWeights.trend)}
              </p>
            </div>
          </div>
          <p className="leading-7 text-slate-700">
            The score is meant to prioritize enforcement attention, not to claim
            that one station has exactly that percentage more traffic impact
            than another.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Model Target</h2>
          <p className="leading-7 text-slate-700">
            The LightGBM model predicts the probability that a police-station
            zone sees at least one road-closure-triggering incident in the
            following week, based on that station&apos;s recent parking-violation
            patterns and recent reported incident activity.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Test ROC-AUC</p>
              <p className="mt-2 text-3xl font-semibold">
                {formatMetric(summary.rocAuc)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Train rows</p>
              <p className="mt-2 text-3xl font-semibold">
                {numberFormat.format(summary.modelRows.train)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Validation rows
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {numberFormat.format(summary.modelRows.validation)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Test rows</p>
              <p className="mt-2 text-3xl font-semibold">
                {numberFormat.format(summary.modelRows.test)}
              </p>
            </div>
          </div>
          <p className="leading-7 text-slate-700">
            The model table contains {numberFormat.format(summary.modelRows.total)}{" "}
            station-week rows after feature construction and time-based
            train/validation/test splitting.
          </p>
        </section>

        <section className="mt-10 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Limitations</h2>
          <p className="leading-7 text-slate-700">
            This measures correlation between parking-violation patterns and
            closure incidents. It is not a direct measurement of congestion or
            minutes of delay, because neither source dataset records those
            quantities directly.
          </p>
          <p className="leading-7 text-slate-700">
            The model is trained on Bengaluru data specifically. Applying the
            same model to another city would require retraining with that
            city&apos;s own violation records, incident records, station geography,
            and reporting practices.
          </p>
          <p className="leading-7 text-slate-700">
            Roughly half of all violation records are not tied to a specific
            junction. For that reason, the most granular ranking unit used here
            is the police-station zone, not individual junctions.
          </p>
        </section>
      </div>
    </main>
  );
}
