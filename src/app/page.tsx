import DashboardClient from "@/components/DashboardClient";
import { getHeatmapGrid, getStationRankings } from "@/lib/data";
import { stationCoordinates } from "@/lib/station-coordinates";
import type { HeatmapCell, StationRanking } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Home() {
  let stationRankings: StationRanking[] = [];
  let heatmapGrid: HeatmapCell[] = [];
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
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Bengaluru traffic enforcement
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            GridSight
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            This week&apos;s enforcement priority, ranked by violation density,
            predicted closure risk, and trend, across 54 Bengaluru
            police-station zones.
          </p>
        </header>

        {dataError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
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
    </main>
  );
}
