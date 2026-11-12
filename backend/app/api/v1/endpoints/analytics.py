import csv
import io
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import Response
from sqlalchemy import case, func

from app.api.deps import CurrentUser, DbSession, RequestId
from app.core.errors import AppError, success_body
from app.ml.dataset_labels import CLASS_LABELS
from app.models import Diagnosis, Prediction, User
from app.models.entities import UserRole

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def overview(db: DbSession, user: CurrentUser, request_id: RequestId):
    q = db.query(Diagnosis).filter_by(user_id=user.id)
    total = q.count()
    completed = q.filter_by(status="COMPLETED").count()
    failed = q.filter_by(status="FAILED").count()

    avg_confidence = (
        db.query(func.avg(Diagnosis.overall_confidence))
        .filter(
            Diagnosis.user_id == user.id,
            Diagnosis.status == "COMPLETED",
            Diagnosis.overall_confidence.isnot(None),
        )
        .scalar()
    ) or 0.0

    healthy_count, top_prediction_count = (
        db.query(
            func.sum(case((Prediction.label == "Healthy", 1), else_=0)),
            func.count(Prediction.id),
        )
        .join(Diagnosis, Diagnosis.id == Prediction.diagnosis_id)
        .filter(
            Diagnosis.user_id == user.id,
            Diagnosis.status == "COMPLETED",
            Prediction.rank == 1,
        )
        .one()
    )
    healthy = healthy_count or 0
    diseased = (top_prediction_count or 0) - healthy

    return success_body(
        {
            "total_diagnoses": total,
            "healthy_detections": healthy,
            "diseased_detections": diseased,
            "average_confidence": avg_confidence,
            "completed_diagnoses": completed,
            "failed_diagnoses": failed,
        },
        request_id,
    )


# ---------------------------------------------------------------------------
# Phase 13: filtered analytics. Scoped to the caller's diagnoses; admins see all.
# ---------------------------------------------------------------------------

DEFAULT_WINDOW_DAYS = 30
MAX_WINDOW_DAYS = 366


def _validate_range(date_from: Optional[date], date_to: Optional[date]) -> None:
    if date_from and date_to and date_from > date_to:
        raise AppError("INVALID_RANGE", "date_from must be on or before date_to.", 422)
    if date_from and date_to and (date_to - date_from).days > MAX_WINDOW_DAYS:
        raise AppError(
            "INVALID_RANGE", f"Date range may not exceed {MAX_WINDOW_DAYS} days.", 422
        )


def _validate_category(category: Optional[str]) -> None:
    if category and category not in CLASS_LABELS:
        raise AppError(
            "INVALID_CATEGORY",
            f"category must be one of: {', '.join(CLASS_LABELS)}.",
            422,
        )


def _filtered_rows(
    db,
    user: User,
    date_from: Optional[date],
    date_to: Optional[date],
    category: Optional[str],
):
    """Rows of (Diagnosis, top_label) matching the filters."""
    _validate_range(date_from, date_to)
    _validate_category(category)
    q = db.query(Diagnosis, Prediction.label).outerjoin(
        Prediction,
        (Prediction.diagnosis_id == Diagnosis.id) & (Prediction.rank == 1),
    )
    if user.role != UserRole.ADMIN.value:
        q = q.filter(Diagnosis.user_id == user.id)
    if date_from:
        q = q.filter(Diagnosis.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(
            Diagnosis.created_at
            < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )
    if category:
        q = q.filter(Prediction.label == category)
    return q.order_by(Diagnosis.created_at.asc()).all()


DateFrom = Query(None, description="Inclusive start date (YYYY-MM-DD)")
DateTo = Query(None, description="Inclusive end date (YYYY-MM-DD)")
CategoryQ = Query(None, description="Top-prediction category filter")


@router.get("/timeseries")
def timeseries(
    db: DbSession,
    user: CurrentUser,
    request_id: RequestId,
    date_from: Optional[date] = DateFrom,
    date_to: Optional[date] = DateTo,
    category: Optional[str] = CategoryQ,
):
    """Daily diagnosis counts (zero-filled). Defaults to the last 30 days."""
    rows = _filtered_rows(db, user, date_from, date_to, category)
    end = date_to or datetime.now(timezone.utc).date()
    start = date_from or (end - timedelta(days=DEFAULT_WINDOW_DAYS - 1))
    counts: Counter = Counter()
    for diagnosis, _label in rows:
        counts[diagnosis.created_at.date()] += 1
    points = []
    day = start
    while day <= end:
        points.append({"date": day.isoformat(), "count": counts.get(day, 0)})
        day += timedelta(days=1)
    return success_body(
        {
            "date_from": start.isoformat(),
            "date_to": end.isoformat(),
            "category": category,
            "total": sum(p["count"] for p in points),
            "points": points,
        },
        request_id,
    )


@router.get("/distribution")
def distribution(
    db: DbSession,
    user: CurrentUser,
    request_id: RequestId,
    date_from: Optional[date] = DateFrom,
    date_to: Optional[date] = DateTo,
    category: Optional[str] = CategoryQ,
):
    """Class/category distribution of top predictions for completed diagnoses."""
    rows = _filtered_rows(db, user, date_from, date_to, category)
    counts: Counter = Counter(
        label for d, label in rows if label and d.status == "COMPLETED"
    )
    total = sum(counts.values())
    items = [
        {
            "label": label,
            "count": counts.get(label, 0),
            "share": round(counts.get(label, 0) / total, 4) if total else 0.0,
        }
        for label in CLASS_LABELS
    ]
    return success_body({"total": total, "items": items}, request_id)


@router.get("/summary")
def summary(
    db: DbSession,
    user: CurrentUser,
    request_id: RequestId,
    date_from: Optional[date] = DateFrom,
    date_to: Optional[date] = DateTo,
    category: Optional[str] = CategoryQ,
):
    """KPIs, average confidence (overall and per category) and quality-status breakdown."""
    rows = _filtered_rows(db, user, date_from, date_to, category)
    completed = [(d, label) for d, label in rows if d.status == "COMPLETED"]
    confs = [d.overall_confidence for d, _ in completed if d.overall_confidence is not None]

    per_cat: dict[str, list[float]] = defaultdict(list)
    for d, label in completed:
        if label and d.overall_confidence is not None:
            per_cat[label].append(d.overall_confidence)

    quality: Counter = Counter((d.quality_status or "unknown") for d, _ in rows)
    healthy = sum(1 for _, label in completed if label == "Healthy")

    return success_body(
        {
            "total_diagnoses": len(rows),
            "completed_diagnoses": len(completed),
            "failed_diagnoses": sum(1 for d, _ in rows if d.status == "FAILED"),
            "healthy_detections": healthy,
            "diseased_detections": sum(1 for _, label in completed if label) - healthy,
            "average_confidence": (sum(confs) / len(confs)) if confs else 0.0,
            "confidence_by_category": [
                {
                    "label": label,
                    "average_confidence": sum(per_cat[label]) / len(per_cat[label]),
                    "count": len(per_cat[label]),
                }
                for label in CLASS_LABELS
                if per_cat.get(label)
            ],
            "quality_breakdown": [
                {"status": status, "count": count}
                for status, count in sorted(quality.items(), key=lambda kv: (-kv[1], kv[0]))
            ],
        },
        request_id,
    )


@router.get("/export.csv")
def export_csv(
    db: DbSession,
    user: CurrentUser,
    date_from: Optional[date] = DateFrom,
    date_to: Optional[date] = DateTo,
    category: Optional[str] = CategoryQ,
):
    """CSV of the caller's diagnoses (admins: all users), honoring the same filters."""
    rows = _filtered_rows(db, user, date_from, date_to, category)
    is_admin = user.role == UserRole.ADMIN.value
    emails = {}
    if is_admin:
        emails = {u.id: u.email for u in db.query(User.id, User.email).all()}

    buf = io.StringIO()
    writer = csv.writer(buf)
    header = [
        "diagnosis_id",
        "created_at",
        "status",
        "top_prediction",
        "confidence",
        "quality_status",
        "inference_time_ms",
    ]
    if is_admin:
        header.insert(1, "user_email")
    writer.writerow(header)
    for d, label in reversed(rows):
        record = [
            d.id,
            d.created_at.isoformat(),
            d.status,
            label or "",
            "" if d.overall_confidence is None else f"{d.overall_confidence:.4f}",
            d.quality_status or "",
            "" if d.inference_time_ms is None else f"{d.inference_time_ms:.1f}",
        ]
        if is_admin:
            record.insert(1, emails.get(d.user_id, ""))
        writer.writerow(record)

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="plantguard-diagnoses.csv"'},
    )
