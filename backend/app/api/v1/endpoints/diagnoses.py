from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DbSession, RequestId
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.errors import AppError, success_body
from app.models import Crop, Diagnosis, Disease, Report
from app.schemas.api import DiagnosisCreate
from app.services.diagnosis import create_diagnosis, get_diagnosis, process_diagnosis
from app.services.report import build_diagnosis_pdf
from app.services.storage import storage_service

router = APIRouter(prefix="/diagnoses", tags=["diagnoses"])


def _run_job(diagnosis_id: str) -> None:
    db = SessionLocal()
    try:
        process_diagnosis(db, diagnosis_id)
    finally:
        db.close()


def _serialize(diagnosis: Diagnosis) -> dict:
    explanation = None
    if diagnosis.explanation:
        explanation = {
            "method": diagnosis.explanation.method,
            "heatmap_url": (
                storage_service.url_for(diagnosis.explanation.heatmap_storage_key)
                if diagnosis.explanation.heatmap_storage_key
                else None
            ),
            "mask_url": None,
            "disclaimer": (
                "Highlighted areas contributed most strongly to the model prediction. "
                "This does not prove a pathogen is present."
            ),
        }
    severity = None
    if diagnosis.severity:
        severity = {
            "severity_score": diagnosis.severity.severity_score,
            "severity_label": diagnosis.severity.severity_label,
            "method": diagnosis.severity.method,
        }
    return {
        "id": diagnosis.id,
        "status": diagnosis.status,
        "job_stage": diagnosis.job_stage,
        "overall_confidence": diagnosis.overall_confidence,
        "inference_time_ms": diagnosis.inference_time_ms,
        "quality_status": diagnosis.quality_status,
        "quality_messages": diagnosis.quality_messages,
        "error_code": diagnosis.error_code,
        "error_message": diagnosis.error_message,
        "image_id": diagnosis.image_id,
        "crop_id": diagnosis.crop_id,
        "model_version_id": diagnosis.model_version_id,
        "created_at": diagnosis.created_at.isoformat(),
        "predictions": [
            {
                "id": p.id,
                "label": p.label,
                "probability": p.probability,
                "rank": p.rank,
                "disease_id": p.disease_id,
            }
            for p in sorted(diagnosis.predictions, key=lambda x: x.rank)
        ],
        "recommendations": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "priority": r.priority,
                "category": r.category,
                "source_metadata": r.source_metadata,
            }
            for r in diagnosis.recommendations
        ],
        "severity": severity,
        "explanation": explanation,
        "image_url": storage_service.url_for(diagnosis.image.object_storage_key)
        if diagnosis.image
        else None,
        "scientific_note": (
            "Output is a visual pathogen-category assessment "
            "(Bacteria, Fungi, Healthy, Pests, or Virus)—not laboratory-confirmed "
            "species-level pathogen identification."
        ),
    }


@router.post("")
def create(
    payload: DiagnosisCreate,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
    request_id: RequestId,
):
    diagnosis = create_diagnosis(db, user.id, payload.image_id, payload.crop_id)
    if settings.USE_INLINE_JOBS:
        background_tasks.add_task(_run_job, diagnosis.id)
    return success_body(
        {
            "job_id": diagnosis.id,
            "diagnosis_id": diagnosis.id,
            "status": diagnosis.status,
            "stage": diagnosis.job_stage,
        },
        request_id,
    )


@router.get("")
def list_diagnoses(db: DbSession, user: CurrentUser, request_id: RequestId):
    rows = (
        db.query(Diagnosis)
        .options(
            joinedload(Diagnosis.predictions),
            joinedload(Diagnosis.recommendations),
            joinedload(Diagnosis.severity),
            joinedload(Diagnosis.explanation),
            joinedload(Diagnosis.image),
        )
        .filter_by(user_id=user.id)
        .order_by(Diagnosis.created_at.desc())
        .limit(100)
        .all()
    )
    return success_body([_serialize(r) for r in rows], request_id)


@router.get("/{diagnosis_id}")
def get_one(diagnosis_id: str, db: DbSession, user: CurrentUser, request_id: RequestId):
    diagnosis = get_diagnosis(db, diagnosis_id, user.id, user.role)
    return success_body(_serialize(diagnosis), request_id)


@router.get("/{diagnosis_id}/explanation")
def explanation(diagnosis_id: str, db: DbSession, user: CurrentUser, request_id: RequestId):
    diagnosis = get_diagnosis(db, diagnosis_id, user.id, user.role)
    data = _serialize(diagnosis)
    return success_body(data.get("explanation"), request_id)


@router.get("/{diagnosis_id}/report")
def report(diagnosis_id: str, db: DbSession, user: CurrentUser):
    diagnosis = (
        db.query(Diagnosis)
        .options(
            joinedload(Diagnosis.predictions),
            joinedload(Diagnosis.recommendations),
            joinedload(Diagnosis.explanation),
            joinedload(Diagnosis.image),
        )
        .filter_by(id=diagnosis_id, user_id=user.id)
        .first()
    )
    if not diagnosis:
        raise AppError("NOT_FOUND", "Diagnosis not found.", 404)
    crop = db.get(Crop, diagnosis.crop_id) if diagnosis.crop_id else None
    top = min(diagnosis.predictions, key=lambda p: p.rank, default=None)
    disease = db.get(Disease, top.disease_id) if top and top.disease_id else None
    pdf = build_diagnosis_pdf(diagnosis, crop.name if crop else None, disease)
    db.add(
        Report(
            user_id=user.id,
            diagnosis_id=diagnosis.id,
            report_type="diagnosis_pdf",
            status="completed",
        )
    )
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="plantguard-report-{diagnosis.id}.pdf"'
        },
    )
