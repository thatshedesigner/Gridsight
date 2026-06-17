export type StationRanking = {
  policeStation: string;
  rank: number;
  priorityScore: number;
  violationDensityScore: number;
  closureRiskScore: number;
  trendScore: number;
  violationCountLastWeek: number;
};

export type HeatmapCell = {
  lat: number;
  lng: number;
  count: number;
};

export type WeeklyTimeSeriesPoint = {
  week: string;
  violationCount: number;
  closureCount: number;
};

export type CountByVehicleType = {
  vehicleType: string;
  count: number;
};

export type CountByViolationType = {
  violationType: string;
  count: number;
};

export type CountByJunction = {
  junctionName: string;
  count: number;
};

export type StationDetail = {
  weeklyTimeSeries: WeeklyTimeSeriesPoint[];
  topVehicleTypes: CountByVehicleType[];
  topViolationTypes: CountByViolationType[];
  topJunctions: CountByJunction[];
};

export type StationDetailIndex = Record<string, StationDetail>;

export type ModelMetrics = {
  metrics: {
    roc_auc: number;
    average_precision: number;
    confusion_matrix: number[][];
    row_counts: {
      train: number;
      validation: number;
      test: number;
    };
    week_ranges: {
      train: [string, string];
      validation: [string, string];
      test: [string, string];
    };
  };
  featureImportance: {
    feature: string;
    importance: number;
    rawFeature: string;
  }[];
};

export type StationCoordinate = {
  policeStation: string;
  lat: number;
  lng: number;
  sampleCount: number;
};
