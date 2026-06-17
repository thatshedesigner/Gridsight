from __future__ import annotations

import ast
import json
from pathlib import Path

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT_DIR / "data" / "raw"
PROCESSED_DIR = ROOT_DIR / "data" / "processed"

VIOLATIONS_RAW = RAW_DIR / "parking_violations.csv"
EVENTS_RAW = RAW_DIR / "traffic_events.csv"
VIOLATIONS_CLEAN = PROCESSED_DIR / "violations_clean.csv"
EVENTS_CLEAN = PROCESSED_DIR / "events_clean.csv"

VIOLATION_COLUMNS = [
    "id",
    "latitude",
    "longitude",
    "location",
    "vehicle_type",
    "violation_type",
    "created_datetime",
    "device_id",
    "police_station",
    "junction_name",
    "validation_status",
]

VIOLATION_DROP_COLUMNS = [
    "description",
    "closed_datetime",
    "action_taken_timestamp",
    "data_sent_to_scita_timestamp",
    "vehicle_number",
    "updated_vehicle_number",
    "updated_vehicle_type",
]

EVENT_COLUMNS = [
    "id",
    "event_type",
    "event_cause",
    "latitude",
    "longitude",
    "start_datetime",
    "closed_datetime",
    "modified_datetime",
    "status",
    "requires_road_closure",
    "corridor",
    "priority",
    "police_station",
    "zone",
    "junction",
]

EVENT_DROP_COLUMNS = [
    "map_file",
    "comment",
    "meta_data",
    "direction",
    "route_path",
    "cargo_material",
    "reason_breakdown",
    "age_of_truck",
    "citizen_accident_id",
    "assigned_to_police_id",
    "resolved_by_id",
    "resolved_datetime",
    "resolved_at_address",
    "resolved_at_latitude",
    "resolved_at_longitude",
    "gba_identifier",
    "closed_by_id",
]


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


def parse_datetime_column(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", utc=True)


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    return pd.read_csv(path)


def keep_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    missing = sorted(set(columns) - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")
    return df.loc[:, columns].copy()


def drop_known_empty_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    return df.drop(columns=[column for column in columns if column in df.columns])


def clean_violations() -> tuple[pd.DataFrame, int]:
    raw_df = read_csv(VIOLATIONS_RAW)
    before_count = len(raw_df)

    raw_df = drop_known_empty_columns(raw_df, VIOLATION_DROP_COLUMNS)
    df = keep_columns(raw_df, VIOLATION_COLUMNS)
    df["created_datetime"] = parse_datetime_column(df["created_datetime"])
    df = df.dropna(subset=["created_datetime"]).copy()
    df["violation_type"] = df["violation_type"].apply(parse_violation_types)

    # "No Junction" means a general road segment, not a missing junction or real place name.

    return df, before_count


def clean_events() -> tuple[pd.DataFrame, int]:
    raw_df = read_csv(EVENTS_RAW)
    before_count = len(raw_df)

    raw_df = drop_known_empty_columns(raw_df, EVENT_DROP_COLUMNS)
    df = keep_columns(raw_df, EVENT_COLUMNS)

    datetime_columns = ["start_datetime", "closed_datetime", "modified_datetime"]
    for column in datetime_columns:
        df[column] = parse_datetime_column(df[column])

    df = df.dropna(subset=["start_datetime"]).copy()

    duration_end = df["closed_datetime"].fillna(df["modified_datetime"])
    duration = duration_end - df["start_datetime"]
    df["event_duration_minutes"] = duration.dt.total_seconds() / 60
    df.loc[df["event_duration_minutes"] < 0, "event_duration_minutes"] = pd.NA

    duration_clip = df["event_duration_minutes"].quantile(0.99)
    if pd.notna(duration_clip):
        df["event_duration_minutes"] = df["event_duration_minutes"].clip(upper=duration_clip)

    return df, before_count


def date_range(df: pd.DataFrame, columns: list[str]) -> tuple[pd.Timestamp | None, pd.Timestamp | None]:
    values = pd.concat([df[column] for column in columns if column in df.columns]).dropna()
    if values.empty:
        return None, None
    return values.min(), values.max()


def format_timestamp(value: pd.Timestamp | None) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    return value.isoformat()


def serialize_list_column(series: pd.Series) -> pd.Series:
    return series.apply(lambda value: json.dumps(value, ensure_ascii=False))


def serialize_datetime_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    output = df.copy()
    for column in columns:
        if column in output.columns:
            output[column] = output[column].apply(
                lambda value: value.isoformat() if pd.notna(value) else ""
            )
    return output


def warn_on_station_overlap(violations: pd.DataFrame, events: pd.DataFrame) -> None:
    violation_stations = set(violations["police_station"].dropna().astype(str).str.strip())
    event_stations = set(events["police_station"].dropna().astype(str).str.strip())

    if not violation_stations or not event_stations:
        print("WARNING: police_station overlap could not be verified because one file has no stations.")
        return

    overlap = violation_stations & event_stations
    smaller_count = min(len(violation_stations), len(event_stations))
    overlap_ratio = len(overlap) / smaller_count

    if overlap_ratio < 0.95:
        missing_from_events = sorted(violation_stations - event_stations)
        missing_from_violations = sorted(event_stations - violation_stations)
        print(
            "WARNING: police_station jurisdictions are not a near-complete match "
            f"({len(overlap)} overlapping stations, {overlap_ratio:.1%} of the smaller set)."
        )
        if missing_from_events:
            print(f"  Missing from traffic_events.csv: {', '.join(missing_from_events)}")
        if missing_from_violations:
            print(f"  Missing from parking_violations.csv: {', '.join(missing_from_violations)}")


def print_summary(
    violations: pd.DataFrame,
    violations_before: int,
    events: pd.DataFrame,
    events_before: int,
) -> None:
    violations_start, violations_end = date_range(violations, ["created_datetime"])
    events_start, events_end = date_range(
        events,
        ["start_datetime", "closed_datetime", "modified_datetime"],
    )

    print("Cleaning summary")
    print(
        "Parking violations: "
        f"{violations_before:,} rows before, {len(violations):,} rows after; "
        f"{violations['police_station'].nunique(dropna=True):,} police_station values; "
        f"{format_timestamp(violations_start)} to {format_timestamp(violations_end)}"
    )
    print(
        "Traffic events: "
        f"{events_before:,} rows before, {len(events):,} rows after; "
        f"{events['police_station'].nunique(dropna=True):,} police_station values; "
        f"{format_timestamp(events_start)} to {format_timestamp(events_end)}"
    )

    if violations["police_station"].nunique(dropna=True) != 54:
        print("WARNING: parking_violations.csv does not contain the expected 54 police_station values.")
    if events["police_station"].nunique(dropna=True) != 54:
        print("WARNING: traffic_events.csv does not contain the expected 54 police_station values.")


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    violations, violations_before = clean_violations()
    events, events_before = clean_events()

    warn_on_station_overlap(violations, events)

    violations_output = serialize_datetime_columns(violations, ["created_datetime"])
    violations_output["violation_type"] = serialize_list_column(violations_output["violation_type"])
    events_output = serialize_datetime_columns(
        events,
        ["start_datetime", "closed_datetime", "modified_datetime"],
    )

    violations_output.to_csv(VIOLATIONS_CLEAN, index=False)
    events_output.to_csv(EVENTS_CLEAN, index=False)

    print_summary(violations, violations_before, events, events_before)


if __name__ == "__main__":
    main()
