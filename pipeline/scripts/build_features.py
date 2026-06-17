from __future__ import annotations

import ast
import json
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT_DIR / "data" / "processed"

VIOLATIONS_CLEAN = PROCESSED_DIR / "violations_clean.csv"
EVENTS_CLEAN = PROCESSED_DIR / "events_clean.csv"
MODEL_DATASET = PROCESSED_DIR / "model_dataset.csv"

HIGH_OBSTRUCTION_TYPES = {
    "PARKING IN A MAIN ROAD",
    "PARKING NEAR ROAD CROSSING",
    "DOUBLE PARKING",
    "PARKING ON FOOTPATH",
}

OUTPUT_COLUMNS = [
    "police_station",
    "week",
    "violation_count",
    "high_obstruction_count",
    "distinct_vehicle_types",
    "event_count",
    "closure_count",
    "congestion_count",
    "pct_change_violations",
    "rolling_4wk_high_obstruction",
    "next_week_had_closure",
]


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    return pd.read_csv(path)


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


def to_boolean_int(series: pd.Series) -> pd.Series:
    if pd.api.types.is_bool_dtype(series):
        return series.astype(int)

    normalized = series.astype(str).str.strip().str.lower()
    return normalized.isin({"true", "1", "yes", "y"}).astype(int)


def add_anchor_week(df: pd.DataFrame, date_column: str, anchor: pd.Timestamp) -> pd.DataFrame:
    output = df.copy()
    days_since_anchor = (output[date_column] - anchor).dt.days
    output["week"] = anchor + pd.to_timedelta((days_since_anchor // 7) * 7, unit="D")
    return output


def build_violation_features(violations: pd.DataFrame, anchor: pd.Timestamp) -> pd.DataFrame:
    violations = add_anchor_week(violations, "created_datetime", anchor)
    violations["violation_type"] = violations["violation_type"].apply(parse_violation_types)
    violations["is_high_obstruction"] = violations["violation_type"].apply(
        lambda types: int(bool(HIGH_OBSTRUCTION_TYPES.intersection(types)))
    )

    return (
        violations.groupby(["police_station", "week"], as_index=False)
        .agg(
            violation_count=("id", "size"),
            high_obstruction_count=("is_high_obstruction", "sum"),
            distinct_vehicle_types=("vehicle_type", "nunique"),
        )
    )


def build_event_features(events: pd.DataFrame, anchor: pd.Timestamp) -> pd.DataFrame:
    events = add_anchor_week(events, "start_datetime", anchor)
    events["requires_road_closure"] = to_boolean_int(events["requires_road_closure"])
    events["is_congestion"] = events["event_cause"].astype(str).str.lower().eq("congestion").astype(int)

    return (
        events.groupby(["police_station", "week"], as_index=False)
        .agg(
            event_count=("id", "size"),
            closure_count=("requires_road_closure", "sum"),
            congestion_count=("is_congestion", "sum"),
        )
    )


def add_station_time_features(panel: pd.DataFrame) -> pd.DataFrame:
    panel = panel.sort_values(["police_station", "week"]).copy()
    station_groups = panel.groupby("police_station", group_keys=False)

    panel["had_closure_this_week"] = (panel["closure_count"] > 0).astype(int)
    panel["next_week_had_closure"] = station_groups["had_closure_this_week"].shift(-1)

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

    panel = panel.dropna(subset=["next_week_had_closure"]).copy()
    panel["next_week_had_closure"] = panel["next_week_had_closure"].astype(int)

    return panel


def format_week_column(series: pd.Series) -> pd.Series:
    return series.dt.strftime("%Y-%m-%d")


def main() -> None:
    violations = read_csv(VIOLATIONS_CLEAN)
    events = read_csv(EVENTS_CLEAN)

    violations["created_datetime"] = parse_datetime_column(violations["created_datetime"])
    events["start_datetime"] = parse_datetime_column(events["start_datetime"])

    violations = violations.dropna(subset=["created_datetime", "police_station"]).copy()
    events = events.dropna(subset=["start_datetime", "police_station"]).copy()

    anchor = min(violations["created_datetime"].min(), events["start_datetime"].min())

    violation_features = build_violation_features(violations, anchor)
    event_features = build_event_features(events, anchor)

    panel = violation_features.merge(
        event_features,
        on=["police_station", "week"],
        how="left",
    )

    zero_fill_columns = ["event_count", "closure_count", "congestion_count"]
    panel[zero_fill_columns] = panel[zero_fill_columns].fillna(0).astype(int)

    panel = add_station_time_features(panel)
    panel["week"] = format_week_column(panel["week"])
    panel = panel.loc[:, OUTPUT_COLUMNS]
    panel = panel.sort_values(["police_station", "week"]).reset_index(drop=True)

    panel.to_csv(MODEL_DATASET, index=False)

    print("Feature build summary")
    print(f"Final panel rows: {len(panel):,}")
    print(f"Base rate next_week_had_closure: {panel['next_week_had_closure'].mean():.2%}")
    print(f"Distinct weeks covered: {panel['week'].nunique():,}")


if __name__ == "__main__":
    main()
