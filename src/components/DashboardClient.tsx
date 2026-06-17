"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import PriorityList from "@/components/PriorityList";
import type { HeatmapCell, StationCoordinate, StationRanking } from "@/lib/types";

const HotspotMap = dynamic(() => import("@/components/HotspotMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[32rem] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
      Map loading
    </div>
  ),
});

type DashboardClientProps = {
  rankings: StationRanking[];
  heatmapGrid: HeatmapCell[];
  stationCoordinates: StationCoordinate[];
};

export default function DashboardClient({
  rankings,
  heatmapGrid,
  stationCoordinates,
}: DashboardClientProps) {
  const [selectedStation, setSelectedStation] = useState<string | null>(
    rankings[0]?.policeStation ?? null,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
      <div className="order-2 lg:order-1">
        <PriorityList
          rankings={rankings}
          selectedStation={selectedStation}
          onSelectStation={setSelectedStation}
        />
      </div>
      <aside className="order-1 lg:sticky lg:top-6 lg:order-2">
        <HotspotMap
          heatmapGrid={heatmapGrid}
          rankings={rankings}
          selectedStation={selectedStation}
          stationCoordinates={stationCoordinates}
          onSelectStation={setSelectedStation}
        />
      </aside>
    </div>
  );
}
