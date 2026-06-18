import DashboardClient from "@/components/DashboardClient";
import {
  getHeatmapGrid,
  getMethodologySummary,
  getStationRankings,
} from "@/lib/data";
import { stationCoordinates } from "@/lib/station-coordinates";
import type { HeatmapCell, StationRanking } from "@/lib/types";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("en-IN");
const headlineNumberFormat = new Intl.NumberFormat("en-US");

function formatApproxRows(value: number) {
  const rounded = value >= 100000 ? Math.round(value / 1000) * 1000 : Math.round(value / 100) * 100;

  return `~${headlineNumberFormat.format(rounded)}`;
}

export default function Home() {
  let stationRankings: StationRanking[] = [];
  let heatmapGrid: HeatmapCell[] = [];
  const methodology = getMethodologySummary();
  let dataError: string | null = null;

  try {
    stationRankings = getStationRankings();
    heatmapGrid = getHeatmapGrid();
  } catch (error) {
    dataError =
      error instanceof Error
        ? error.message
        : "The dashboard data could not be loaded.";
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <header className="px-5 pb-8 pt-8 sm:px-8 lg:px-0 lg:pt-10">
          <section className="overflow-hidden rounded-lg bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
              Bengaluru traffic enforcement
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                  GridSight ranks weekly enforcement priority across Bengaluru.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                  It fuses anonymized parking-violation and traffic-incident
                  records to highlight police-station zones where enforcement is
                  most likely to reduce closure risk.
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Violations
                  </p>
                  <p className="mt-2 whitespace-nowrap text-[1.65rem] font-semibold tabular-nums leading-tight sm:text-2xl lg:text-[1.65rem] xl:text-2xl">
                    {formatApproxRows(methodology.parkingViolationRows)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Incidents
                  </p>
                  <p className="mt-2 whitespace-nowrap text-[1.65rem] font-semibold tabular-nums leading-tight sm:text-2xl lg:text-[1.65rem] xl:text-2xl">
                    {formatApproxRows(methodology.trafficIncidentRows)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Zones
                  </p>
                  <p className="mt-2 whitespace-nowrap text-[1.65rem] font-semibold tabular-nums leading-tight sm:text-2xl lg:text-[1.65rem] xl:text-2xl">
                    {numberFormat.format(methodology.stationCount)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </header>

        <div className="px-5 pb-10 sm:px-8 lg:px-0">
          {dataError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
            <h2 className="text-base font-semibold">Unable to load station rankings</h2>
            <p className="mt-2 text-sm leading-6">{dataError}</p>
          </div>
          ) : (
            <DashboardClient
              heatmapGrid={heatmapGrid}
              rankings={stationRankings}
              stationCoordinates={stationCoordinates}
            />
          )}
        </div>
      </div>
    </main>
  );
}
