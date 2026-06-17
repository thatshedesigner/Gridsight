import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  HeatmapCell,
  ModelMetrics,
  StationDetail,
  StationDetailIndex,
  StationRanking,
} from "./types";
export type {
  HeatmapCell,
  ModelMetrics,
  StationDetail,
  StationDetailIndex,
  StationRanking,
} from "./types";

const dataDirectory = path.join(process.cwd(), "src", "data");

function readJsonFile<T>(fileName: string): T {
  const filePath = path.join(dataDirectory, fileName);

  try {
    const contents = readFileSync(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read or parse ${fileName}: ${message}`);
  }
}

export function getStationRankings(): StationRanking[] {
  return readJsonFile<StationRanking[]>("station-rankings.json");
}

export function getHeatmapGrid(): HeatmapCell[] {
  return readJsonFile<HeatmapCell[]>("heatmap-grid.json");
}

export function getStationDetail(policeStation: string): StationDetail {
  const stationDetails = readJsonFile<StationDetailIndex>("station-detail.json");
  const stationDetail = stationDetails[policeStation];

  if (!stationDetail) {
    throw new Error(`No station detail found for police station: ${policeStation}`);
  }

  return stationDetail;
}

export function getModelMetrics(): ModelMetrics {
  return readJsonFile<ModelMetrics>("model-metrics.json");
}
