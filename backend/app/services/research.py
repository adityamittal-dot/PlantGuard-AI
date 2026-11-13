"""Dataset summary and model metric helpers for the research dashboard.

Everything here reads local files only (ml/datasets/DATASET.md and the model
*.meta.json files). Nothing is downloaded.
"""
import json
import re
from pathlib import Path
from typing import Optional

from app.ml.dataset_labels import CLASS_LABELS
from app.models import ModelVersion

DATASET_NAME = "Pathogen dataset (visual symptom categories)"
DATASET_SOURCE = "https://www.kaggle.com/datasets/kanishk3813/pathogen-dataset"

# Seeded fallback (mirrors ml/datasets/DATASET.md) for deployments without the file.
FALLBACK_COUNTS = {
    "Bacteria": 7999,
    "Fungi": 8000,
    "Healthy": 8000,
    "Pests": 7999,
    "Virus": 3679,
}

_ROW = re.compile(r"^\|\s*([A-Za-z][\w ]*?)\s*\|\s*~?\s*([\d,]+)")


def dataset_md_path() -> Path:
    # backend/app/services/research.py -> repo root is parents[3]
    return Path(__file__).resolve().parents[3] / "ml" / "datasets" / "DATASET.md"


def _parse_counts(text: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for line in text.splitlines():
        m = _ROW.match(line.strip())
        if m and m.group(1) in CLASS_LABELS:
            counts[m.group(1)] = int(m.group(2).replace(",", ""))
    return counts


def dataset_summary() -> dict:
    counts: dict[str, int] = {}
    source = "seeded"
    path = dataset_md_path()
    try:
        if path.exists():
            counts = _parse_counts(path.read_text(encoding="utf-8"))
            if counts:
                source = "ml/datasets/DATASET.md"
    except OSError:
        counts = {}
    if not counts:
        counts = dict(FALLBACK_COUNTS)
    total = sum(counts.values())
    classes = [
        {
            "label": label,
            "count": counts[label],
            "share": round(counts[label] / total, 4) if total else 0.0,
        }
        for label in CLASS_LABELS
        if label in counts
    ]
    largest = max((c["count"] for c in classes), default=0)
    smallest = min((c["count"] for c in classes), default=0)
    return {
        "name": DATASET_NAME,
        "source_url": DATASET_SOURCE,
        "source": source,
        "approximate": True,
        "total_images": total,
        "class_count": len(classes),
        "imbalance_ratio": round(largest / smallest, 2) if smallest else None,
        "classes": classes,
        "note": (
            "Labels are visual symptom categories, not laboratory-confirmed pathogen "
            "identification. Counts are approximate."
        ),
    }


def _read_meta(path: Path) -> Optional[dict]:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return None


def meta_for_version(mv: ModelVersion) -> Optional[dict]:
    """meta.json that sits next to the version's artifact (production_cnn.pt -> production_cnn.meta.json)."""
    if not mv.artifact_uri:
        return None
    return _read_meta(Path(mv.artifact_uri).with_suffix(".meta.json"))


_REPORT_ROW = re.compile(
    r"^\s*(?P<name>[A-Za-z][\w ]*?)\s+(?P<p>\d\.\d+)\s+(?P<r>\d\.\d+)\s+(?P<f>\d\.\d+)\s+(?P<s>\d+)\s*$"
)
_REPORT_AVG = re.compile(
    r"^\s*(?P<name>macro avg|weighted avg)\s+(?P<p>\d\.\d+)\s+(?P<r>\d\.\d+)\s+(?P<f>\d\.\d+)\s+(?P<s>\d+)\s*$"
)


def parse_classification_report(report: str) -> dict:
    classes: list[dict] = []
    macro: Optional[dict] = None
    for line in report.splitlines():
        avg = _REPORT_AVG.match(line)
        if avg:
            if avg.group("name") == "macro avg":
                macro = {
                    "precision": float(avg.group("p")),
                    "recall": float(avg.group("r")),
                    "f1": float(avg.group("f")),
                }
            continue
        m = _REPORT_ROW.match(line)
        if m:
            classes.append(
                {
                    "label": m.group("name"),
                    "precision": float(m.group("p")),
                    "recall": float(m.group("r")),
                    "f1": float(m.group("f")),
                    "support": int(m.group("s")),
                }
            )
    return {"classes": classes, "macro": macro}


def version_metrics(mv: ModelVersion, meta: Optional[dict]) -> dict:
    """Metrics from the DB row, falling back to the meta.json next to the artifact."""
    metrics = {
        "accuracy": mv.accuracy,
        "precision": mv.precision,
        "recall": mv.recall,
        "f1_score": mv.f1_score,
        "inference_time_ms": mv.inference_time_ms,
    }
    if meta:
        report = parse_classification_report(meta.get("classification_report", "") or "")
        macro = report["macro"] or {}
        fallback = {
            "accuracy": meta.get("test_accuracy"),
            "precision": macro.get("precision"),
            "recall": macro.get("recall"),
            "f1_score": meta.get("test_macro_f1", macro.get("f1")),
        }
        for key, val in fallback.items():
            if metrics[key] is None and val is not None:
                metrics[key] = val
    return metrics
