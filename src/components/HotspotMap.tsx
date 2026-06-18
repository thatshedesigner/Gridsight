"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { HeatmapCell, StationCoordinate, StationRanking } from "@/lib/types";

type HotspotMapProps = {
  heatmapGrid: HeatmapCell[];
  rankings: StationRanking[];
  stationCoordinates: StationCoordinate[];
  selectedStation: string | null;
  onSelectStation: (policeStation: string) => void;
};

type StationMarker = StationRanking &
  StationCoordinate & {
    color: string;
    priorityTier: string;
  };

const bengaluruCenter: LatLngExpression = [12.9716, 77.5946];

function getPriorityStyle(score: number) {
  if (score >= 75) {
    return { color: "#dc2626", priorityTier: "High" };
  }

  if (score >= 45) {
    return { color: "#d97706", priorityTier: "Medium" };
  }

  return { color: "#059669", priorityTier: "Low" };
}

function getHeatColor(value: number, max: number) {
  const intensity = max > 0 ? value / max : 0;

  if (intensity >= 0.6) {
    return "#dc2626";
  }

  if (intensity >= 0.25) {
    return "#f59e0b";
  }

  return "#059669";
}

function MapSelectionSync({
  selectedStation,
  stationMarkers,
}: {
  selectedStation: string | null;
  stationMarkers: StationMarker[];
}) {
  const map = useMap();

  useEffect(() => {
    const station = stationMarkers.find(
      (marker) => marker.policeStation === selectedStation,
    );

    if (station) {
      map.flyTo([station.lat, station.lng], Math.max(map.getZoom(), 12), {
        duration: 0.7,
      });
    }
  }, [map, selectedStation, stationMarkers]);

  return null;
}

export default function HotspotMap({
  heatmapGrid,
  rankings,
  stationCoordinates,
  selectedStation,
  onSelectStation,
}: HotspotMapProps) {
  const router = useRouter();

  const stationMarkers = useMemo<StationMarker[]>(() => {
    const coordinatesByStation = new Map(
      stationCoordinates.map((station) => [station.policeStation, station]),
    );

    return rankings
      .map((ranking) => {
        const coordinates = coordinatesByStation.get(ranking.policeStation);

        if (!coordinates) {
          return null;
        }

        return {
          ...ranking,
          ...coordinates,
          ...getPriorityStyle(ranking.priorityScore),
        };
      })
      .filter((station): station is StationMarker => Boolean(station));
  }, [rankings, stationCoordinates]);

  const visibleHeatCells = useMemo(() => {
    return [...heatmapGrid].sort((a, b) => b.count - a.count).slice(0, 1800);
  }, [heatmapGrid]);

  const maxHeatCount = visibleHeatCells[0]?.count ?? 0;

  if (rankings.length === 0 || stationMarkers.length === 0) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Violation hotspots</h2>
          <p className="mt-1 text-sm text-slate-500">
            Map data will appear when station rankings and coordinates are available.
          </p>
        </div>
        <div className="flex h-[22rem] items-center justify-center px-6 text-center text-sm leading-6 text-slate-500 sm:h-[30rem]">
          No mapped station data is available.
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Violation hotspots</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dense cells show violation concentration; station markers follow priority tiers.
        </p>
      </div>
      <div className="h-[22rem] sm:h-[30rem] lg:h-[calc(100vh-12rem)] lg:min-h-[30rem]">
        <MapContainer
          center={bengaluruCenter}
          className="h-full w-full"
          maxZoom={18}
          minZoom={10}
          scrollWheelZoom={false}
          zoom={11}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visibleHeatCells.map((cell) => {
            const intensity = maxHeatCount > 0 ? cell.count / maxHeatCount : 0;
            const radius = 2 + Math.sqrt(intensity) * 13;

            return (
              <CircleMarker
                center={[cell.lat, cell.lng]}
                fillColor={getHeatColor(cell.count, maxHeatCount)}
                fillOpacity={0.18 + intensity * 0.28}
                key={`${cell.lat}-${cell.lng}-${cell.count}`}
                opacity={0}
                radius={radius}
                stroke={false}
              />
            );
          })}

          {stationMarkers.map((station) => {
            const isSelected = selectedStation === station.policeStation;

            return (
              <CircleMarker
                center={[station.lat, station.lng]}
                color="#ffffff"
                eventHandlers={{
                  click: () => {
                    onSelectStation(station.policeStation);
                    router.push(`/station/${encodeURIComponent(station.policeStation)}`);
                  },
                  mouseover: () => onSelectStation(station.policeStation),
                }}
                fillColor={station.color}
                fillOpacity={0.95}
                key={station.policeStation}
                opacity={1}
                radius={isSelected ? 11 : 7}
                weight={isSelected ? 4 : 2}
              >
                <Popup>
                  <div className="min-w-36">
                    <div className="font-semibold">{station.policeStation}</div>
                    <div>Rank #{station.rank}</div>
                    <div>{station.priorityScore.toFixed(1)} priority score</div>
                    <div>{station.priorityTier} priority</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          <MapSelectionSync
            selectedStation={selectedStation}
            stationMarkers={stationMarkers}
          />
        </MapContainer>
      </div>
    </section>
  );
}
