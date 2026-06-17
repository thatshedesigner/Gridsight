from __future__ import annotations

import json
from pathlib import Path

import lightgbm as lgb
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    roc_auc_score,
)


ROOT_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT_DIR / "data" / "processed"

MODEL_DATASET = PROCESSED_DIR / "model_dataset.csv"
MODEL_OUTPUT = PROCESSED_DIR / "model.txt"
METRICS_OUTPUT = PROCESSED_DIR / "model_metrics.json"
FEATURE_IMPORTANCE_OUTPUT = PROCESSED_DIR / "feature_importance.json"

FEATURE_COLUMNS = [
    "violation_count",
    "high_obstruction_count",
    "distinct_vehicle_types",
    "event_count",
    "congestion_count",
    "pct_change_violations",
    "rolling_4wk_high_obstruction",
]
TARGET_COLUMN = "next_week_had_closure"


def read_model_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")

    df = pd.read_csv(path)
    required_columns = {"week", TARGET_COLUMN, *FEATURE_COLUMNS}
    missing = sorted(required_columns - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df["week"] = pd.to_datetime(df["week"], errors="coerce")
    df = df.dropna(subset=["week"]).copy()
    return df.sort_values(["week", "police_station"]).reset_index(drop=True)


def chronological_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    weeks = sorted(df["week"].dropna().unique())
    if len(weeks) < 5:
        raise ValueError("Need at least 5 distinct weeks for train/validation/test splitting.")

    train_week_count = max(1, round(len(weeks) * 0.60))
    validation_week_count = max(1, round(len(weeks) * 0.20))

    if train_week_count + validation_week_count >= len(weeks):
        validation_week_count = max(1, len(weeks) - train_week_count - 1)

    test_start = train_week_count + validation_week_count
    train_weeks = set(weeks[:train_week_count])
    validation_weeks = set(weeks[train_week_count:test_start])
    test_weeks = set(weeks[test_start:])

    train = df[df["week"].isin(train_weeks)].copy()
    validation = df[df["week"].isin(validation_weeks)].copy()
    test = df[df["week"].isin(test_weeks)].copy()

    if train.empty or validation.empty or test.empty:
        raise ValueError("Chronological split produced an empty train, validation, or test set.")

    return train, validation, test


def train_model(train: pd.DataFrame, validation: pd.DataFrame) -> lgb.LGBMClassifier:
    model = lgb.LGBMClassifier(
        objective="binary",
        num_leaves=15,
        learning_rate=0.05,
        n_estimators=300,
        is_unbalance=True,
        n_jobs=1,
        random_state=42,
        verbose=-1,
    )

    model.fit(
        train[FEATURE_COLUMNS],
        train[TARGET_COLUMN],
        eval_set=[(validation[FEATURE_COLUMNS], validation[TARGET_COLUMN])],
        eval_metric="auc",
        callbacks=[
            lgb.early_stopping(stopping_rounds=20, verbose=False),
            lgb.log_evaluation(period=0),
        ],
    )
    return model


def evaluate_model(model: lgb.LGBMClassifier, test: pd.DataFrame) -> dict[str, object]:
    probabilities = model.predict_proba(test[FEATURE_COLUMNS])[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    target = test[TARGET_COLUMN]

    return {
        "roc_auc": roc_auc_score(target, probabilities),
        "average_precision": average_precision_score(target, probabilities),
        "confusion_matrix": confusion_matrix(target, predictions, labels=[0, 1]).tolist(),
    }


def save_metrics(
    metrics: dict[str, object],
    train: pd.DataFrame,
    validation: pd.DataFrame,
    test: pd.DataFrame,
) -> None:
    payload = {
        **metrics,
        "row_counts": {
            "train": len(train),
            "validation": len(validation),
            "test": len(test),
        },
        "week_ranges": {
            "train": [
                train["week"].min().date().isoformat(),
                train["week"].max().date().isoformat(),
            ],
            "validation": [
                validation["week"].min().date().isoformat(),
                validation["week"].max().date().isoformat(),
            ],
            "test": [
                test["week"].min().date().isoformat(),
                test["week"].max().date().isoformat(),
            ],
        },
    }

    METRICS_OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def save_feature_importance(model: lgb.LGBMClassifier) -> None:
    booster = model.booster_
    importances = booster.feature_importance(importance_type="gain")
    payload = sorted(
        [
            {"feature": feature, "importance": float(importance)}
            for feature, importance in zip(FEATURE_COLUMNS, importances, strict=True)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )

    FEATURE_IMPORTANCE_OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    df = read_model_dataset(MODEL_DATASET)
    train, validation, test = chronological_split(df)

    model = train_model(train, validation)
    metrics = evaluate_model(model, test)

    model.booster_.save_model(str(MODEL_OUTPUT))
    save_metrics(metrics, train, validation, test)
    save_feature_importance(model)

    print("Held-out test metrics")
    print(f"ROC-AUC: {metrics['roc_auc']:.4f}")
    print(f"PR-AUC: {metrics['average_precision']:.4f}")


if __name__ == "__main__":
    main()
