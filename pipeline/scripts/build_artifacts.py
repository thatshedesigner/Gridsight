from __future__ import annotations

import ast
import json
from pathlib import Path

import lightgbm as lgb
import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
APP_DATA_DIR = ROOT_DIR / "src" / "data"

MODEL_DATASET = PROCESSED_DIR / "model_dataset.csv"
MODEL_FILE = PROCESSED_DIR / "model.txt"
MODEL_METRICS_FILE = PROCESSED_DIR / "model_metrics.json"
FEATURE_IMPORTANCE_FILE = PROCESSED_DIR / "feature_importance.json"
VIOLATIONS_CLEAN_FILE = PROCESSED_DIR / "violations_clean.csv"
EVENTS_CLEAN_FILE = PROCESSED_DIR / "events_clean.csv"

STATION_RANKINGS_FILE = APP_DATA_DIR / "station-rankings.json"
HEATMAP_GRID_FILE = APP_DATA_DIR / "heatmap-grid.json"
STATION_DETAIL_FILE = APP_DATA_DIR / "station-detail.json"
APP_MODEL_METRICS_FILE = APP_DATA_DIR / "model-metrics.json"

FEATURE_COLUMNS = [
    "violation_count",
    "high_obstruction_count",
    "distinct_vehicle_types",
    "event_count",
    "congestion_count",
    "pct_change_violations",
    "rolling_4wk_high_obstruction",
]

FRONTEND_FEATURE_NAMES = {
    "violation_count": "Weekly parking violations",
    "high_obstruction_count": "Main-road and footpath parking violations",
    "distinct_vehicle_types": "Distinct vehicle types involved",
    "event_count": "Traffic incidents this week",
    "congestion_count": "Congestion incidents this week",
    "pct_change_violations": "Violation trend versus prior three weeks",
    "rolling_4wk_high_obstruction": "Four-week average of obstruction violations",
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    return pd.read_csv(path)


def read_json(path: Path) -> object:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def parse_datetime_column(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", utc=True)


def parse_violation_types(value: object) -> list[str]:
    if isinstance(value, list):
        return value

    if pd.isna(value):
        return []

    text = str(value).strip()
    if not text:
        return []

    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(text)
        except (ValueError, SyntaxError, TypeError, json.JSONDecodeError):
            continue

        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]

    return []


def add_anchor_week(df: pd.DataFrame, date_column: str, anchor: pd.Timestamp) -> pd.DataFrame:
    output = df.copy()
    days_since_anchor = (output[date_column] - anchor).dt.days
    output["week"] = anchor + pd.to_timedelta((days_since_anchor // 7) * 7, unit="D")
    return output


def percentile_rank(series: pd.Series) -> pd.Series:
    if series.nunique(dropna=False) <= 1:
        return pd.Series([50.0] * len(series), index=series.index)
    return (series.rank(method="average", pct=True) * 100).round(2)


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_inputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, lgb.Booster, dict[str, object], list[dict[str, object]]]:
    model_df = read_csv(MODEL_DATASET)
    model_df["week"] = pd.to_datetime(model_df["week"], errors="coerce", utc=True)
    model_df = model_df.dropna(subset=["week"]).copy()

    violations_df = read_csv(VIOLATIONS_CLEAN_FILE)
    violations_df["created_datetime"] = parse_datetime_column(violations_df["created_datetime"])
    violations_df = violations_df.dropna(subset=["created_datetime", "police_station", "latitude", "longitude"]).copy()

    events_df = read_csv(EVENTS_CLEAN_FILE)
    events_df["start_datetime"] = parse_datetime_column(events_df["start_datetime"])
    events_df = events_df.dropna(subset=["start_datetime", "police_station"]).copy()

    booster = lgb.Booster(model_file=str(MODEL_FILE))
    metrics = read_json(MODEL_METRICS_FILE)
    feature_importance = read_json(FEATURE_IMPORTANCE_FILE)

    if not isinstance(metrics, dict):
        raise ValueError("model_metrics.json must contain an object.")
    if not isinstance(feature_importance, list):
        raise ValueError("feature_importance.json must contain a list.")

    return model_df, violations_df, events_df, booster, metrics, feature_importance


def build_weekly_feature_panel(
    violations_df: pd.DataFrame,
    events_df: pd.DataFrame,
    latest_week_label: str,
) -> pd.DataFrame:
    anchor = min(violations_df["created_datetime"].min(), events_df["start_datetime"].min())
    station_names = sorted(violations_df["police_station"].dropna().astype(str).str.strip().unique())

    violation_weeks = add_anchor_week(violations_df.copy(), "created_datetime", anchor)
    violation_weeks["violation_type"] = violation_weeks["violation_type"].apply(parse_violation_types)
    violation_weeks["is_high_obstruction"] = violation_weeks["violation_type"].apply(
        lambda types: int(bool({"PARKING IN A MAIN ROAD", "PARKING NEAR ROAD CROSSING", "DOUBLE PARKING", "PARKING ON FOOTPATH"}.intersection(types)))
    )
    violation_weeks["week"] = violation_weeks["week"].dt.strftime("%Y-%m-%d")

    weekly_violations = (
        violation_weeks.groupby(["police_station", "week"], as_index=False)
        .agg(
            violation_count=("id", "size"),
            high_obstruction_count=("is_high_obstruction", "sum"),
            distinct_vehicle_types=("vehicle_type", "nunique"),
        )
    )

    event_weeks = add_anchor_week(events_df.copy(), "start_datetime", anchor)
    event_weeks["requires_road_closure"] = (
        event_weeks["requires_road_closure"].astype(str).str.strip().str.lower().isin({"true", "1", "yes", "y"}).astype(int)
    )
    event_weeks["is_congestion"] = event_weeks["event_cause"].astype(str).str.lower().eq("congestion").astype(int)
    event_weeks["week"] = event_weeks["week"].dt.strftime("%Y-%m-%d")

    weekly_events = (
        event_weeks.groupby(["police_station", "week"], as_index=False)
        .agg(
            event_count=("id", "size"),
            closure_count=("requires_road_closure", "sum"),
            congestion_count=("is_congestion", "sum"),
        )
    )

    first_week_label = min(
        weekly_violations["week"].min(),
        weekly_events["week"].min(),
    )
    week_labels = pd.date_range(
        start=pd.Timestamp(first_week_label),
        end=pd.Timestamp(latest_week_label),
        freq="7D",
    ).strftime("%Y-%m-%d")

    panel = pd.MultiIndex.from_product(
        [station_names, week_labels],
        names=["police_station", "week"],
    ).to_frame(index=False)

    panel = panel.merge(weekly_violations, on=["police_station", "week"], how="left")
    panel = panel.merge(weekly_events, on=["police_station", "week"], how="left")

    count_columns = [
        "violation_count",
        "high_obstruction_count",
        "distinct_vehicle_types",
        "event_count",
        "closure_count",
        "congestion_count",
    ]
    panel[count_columns] = panel[count_columns].fillna(0).astype(int)

    panel["week_dt"] = pd.to_datetime(panel["week"], utc=True)
    panel = panel.sort_values(["police_station", "week_dt"]).copy()
    station_groups = panel.groupby("police_station", group_keys=False)

    prior_3wk_avg = station_groups["violation_count"].transform(
        lambda values: values.shift(1).rolling(window=3, min_periods=3).mean()
    )
    panel["pct_change_violations"] = (
        (panel["violation_count"] - prior_3wk_avg) / prior_3wk_avg
    ).where(prior_3wk_avg.ne(0), 0)
    panel["pct_change_violations"] = panel["pct_change_violations"].fillna(0)
    panel["rolling_4wk_high_obstruction"] = station_groups["high_obstruction_count"].transform(
        lambda values: values.rolling(window=4, min_periods=1).mean()
    )

    return panel


def build_station_rankings(
    model_df: pd.DataFrame,
    violations_df: pd.DataFrame,
    events_df: pd.DataFrame,
    booster: lgb.Booster,
) -> list[dict[str, object]]:
    latest_week_label = model_df["week"].max().strftime("%Y-%m-%d")
    latest_df = build_weekly_feature_panel(violations_df, events_df, latest_week_label)
    latest_df = latest_df[latest_df["week"] == latest_week_label].copy()
    latest_df["closure_probability"] = booster.predict(latest_df[FEATURE_COLUMNS])

    latest_df["violationDensityScore"] = percentile_rank(latest_df["violation_count"])
    latest_df["closureRiskScore"] = percentile_rank(latest_df["closure_probability"])
    latest_df["trendScore"] = percentile_rank(latest_df["pct_change_violations"])
    latest_df["priorityScore"] = (
        0.4 * latest_df["violationDensityScore"]
        + 0.4 * latest_df["closureRiskScore"]
        + 0.2 * latest_df["trendScore"]
    ).round(2)

    latest_df = latest_df.sort_values(["priorityScore", "police_station"], ascending=[False, True]).reset_index(drop=True)
    latest_df["rank"] = latest_df.index + 1

    return [
        {
            "policeStation": row["police_station"],
            "rank": int(row["rank"]),
            "priorityScore": round(float(row["priorityScore"]), 2),
            "violationDensityScore": round(float(row["violationDensityScore"]), 2),
            "closureRiskScore": round(float(row["closureRiskScore"]), 2),
            "trendScore": round(float(row["trendScore"]), 2),
            "violationCountLastWeek": int(row["violation_count"]),
        }
        for _, row in latest_df.iterrows()
    ]


def build_heatmap_grid(violations_df: pd.DataFrame) -> tuple[list[dict[str, object]], int, float]:
    decimals = 3
    heatmap = aggregate_heatmap_cells(violations_df, decimals)
    if len(heatmap) > 15000:
        decimals = 2
        heatmap = aggregate_heatmap_cells(violations_df, decimals)

    payload = [
        {
            "lat": float(row["lat"]),
            "lng": float(row["lng"]),
            "count": int(row["count"]),
        }
        for _, row in heatmap.iterrows()
    ]

    serialized = json.dumps(payload, indent=2)
    size_kb = len(serialized.encode("utf-8")) / 1024
    return payload, len(heatmap), size_kb


def aggregate_heatmap_cells(violations_df: pd.DataFrame, decimals: int) -> pd.DataFrame:
    heatmap = violations_df.copy()
    heatmap["lat"] = heatmap["latitude"].round(decimals)
    heatmap["lng"] = heatmap["longitude"].round(decimals)
    return (
        heatmap.groupby(["lat", "lng"], as_index=False)
        .size()
        .rename(columns={"size": "count"})
        .sort_values("count", ascending=False)
        .reset_index(drop=True)
    )


def build_station_detail(
    violations_df: pd.DataFrame,
    events_df: pd.DataFrame,
) -> dict[str, dict[str, object]]:
    anchor = min(violations_df["created_datetime"].min(), events_df["start_datetime"].min())

    violation_weeks = add_anchor_week(violations_df, "created_datetime", anchor)
    event_weeks = add_anchor_week(events_df, "start_datetime", anchor)

    weekly_violations = (
        violation_weeks.groupby(["police_station", "week"], as_index=False)
        .agg(violationCount=("id", "size"))
    )
    weekly_events = event_weeks.copy()
    weekly_events["requires_road_closure"] = (
        weekly_events["requires_road_closure"].astype(str).str.strip().str.lower().isin({"true", "1", "yes", "y"}).astype(int)
    )
    weekly_closures = (
        weekly_events.groupby(["police_station", "week"], as_index=False)
        .agg(closureCount=("requires_road_closure", "sum"))
    )

    weekly_panel = weekly_violations.merge(
        weekly_closures,
        on=["police_station", "week"],
        how="left",
    )
    weekly_panel["closureCount"] = weekly_panel["closureCount"].fillna(0).astype(int)
    weekly_panel["week"] = weekly_panel["week"].dt.strftime("%Y-%m-%d")

    violation_weeks["violation_type"] = violation_weeks["violation_type"].apply(parse_violation_types)

    station_detail: dict[str, dict[str, object]] = {}
    station_names = sorted(violation_weeks["police_station"].dropna().astype(str).unique())

    for station in station_names:
        station_violations = violation_weeks[violation_weeks["police_station"] == station].copy()
        station_panel = weekly_panel[weekly_panel["police_station"] == station].sort_values("week")

        vehicle_counts = (
            station_violations["vehicle_type"]
            .dropna()
            .astype(str)
            .value_counts()
            .head(5)
        )
        top_vehicle_types = [
            {"vehicleType": vehicle_type, "count": int(count)}
            for vehicle_type, count in vehicle_counts.items()
        ]

        flattened_violation_types = pd.Series(
            [item for values in station_violations["violation_type"] for item in values],
            dtype="object",
        )
        top_violation_subtypes = [
            {"violationType": violation_type, "count": int(count)}
            for violation_type, count in flattened_violation_types.value_counts().head(3).items()
        ]

        real_junctions = station_violations[
            station_violations["junction_name"].fillna("").astype(str).str.strip().ne("No Junction")
            & station_violations["junction_name"].fillna("").astype(str).str.strip().ne("")
        ]
        top_junctions = [
            {"junctionName": junction_name, "count": int(count)}
            for junction_name, count in real_junctions["junction_name"].astype(str).value_counts().head(5).items()
        ]

        station_detail[station] = {
            "weeklyTimeSeries": [
                {
                    "week": row["week"],
                    "violationCount": int(row["violationCount"]),
                    "closureCount": int(row["closureCount"]),
                }
                for _, row in station_panel.iterrows()
            ],
            "topVehicleTypes": top_vehicle_types,
            "topViolationTypes": top_violation_subtypes,
            "topJunctions": top_junctions,
        }

    return station_detail


def build_model_metrics_payload(
    metrics: dict[str, object],
    feature_importance: list[dict[str, object]],
) -> dict[str, object]:
    formatted_importance = []
    for item in feature_importance:
        feature = str(item["feature"])
        formatted_importance.append(
            {
                "feature": FRONTEND_FEATURE_NAMES.get(feature, feature),
                "importance": float(item["importance"]),
                "rawFeature": feature,
            }
        )

    return {
        "metrics": metrics,
        "featureImportance": formatted_importance,
    }


def print_output_summary(paths: list[Path]) -> None:
    print("Artifact summary")
    for path in paths:
        size_kb = path.stat().st_size / 1024
        print(f"{path}: {size_kb:.2f} KB")


def main() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

    model_df, violations_df, events_df, booster, metrics, feature_importance = load_inputs()

    station_rankings = build_station_rankings(model_df, violations_df, events_df, booster)
    heatmap_grid, heatmap_cell_count, heatmap_size_kb = build_heatmap_grid(violations_df)
    station_detail = build_station_detail(violations_df, events_df)
    app_model_metrics = build_model_metrics_payload(metrics, feature_importance)

    write_json(STATION_RANKINGS_FILE, station_rankings)
    write_json(HEATMAP_GRID_FILE, heatmap_grid)
    write_json(STATION_DETAIL_FILE, station_detail)
    write_json(APP_MODEL_METRICS_FILE, app_model_metrics)

    print(f"Heatmap cells: {heatmap_cell_count:,}")
    print(f"Heatmap file size: {heatmap_size_kb:.2f} KB")
    print_output_summary(
        [
            STATION_RANKINGS_FILE,
            HEATMAP_GRID_FILE,
            STATION_DETAIL_FILE,
            APP_MODEL_METRICS_FILE,
        ]
    )


if __name__ == "__main__":
    main()
