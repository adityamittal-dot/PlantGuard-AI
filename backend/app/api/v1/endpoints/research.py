from pathlib import Path

from fastapi import APIRouter, Depends, Request

from app.api.deps import CurrentUser, DbSession, RequestId, require_roles
from app.core.errors import AppError, success_body
from app.models import ModelVersion
from app.models.entities import ModelVersionStatus, UserRole
from app.services.audit import record_audit
from app.services.research import (
    dataset_summary,
    meta_for_version,
    parse_classification_report,
    version_metrics,
)

router = APIRouter(prefix="/research", tags=["research"])

ResearcherOrAdmin = Depends(require_roles(UserRole.RESEARCHER, UserRole.ADMIN))
AdminOnly = Depends(require_roles(UserRole.ADMIN))


def _serialize_version(mv: ModelVersion) -> dict:
    meta = meta_for_version(mv)
    return {
        "id": mv.id,
        "model_id": mv.model_id,
        "model_name": mv.model.name,
        "architecture": (meta or {}).get("architecture") or mv.model.architecture,
        "framework": mv.model.framework,
        "version": mv.version,
        "status": mv.status,
        "is_active": mv.status == ModelVersionStatus.PRODUCTION.value,
        "artifact_uri": mv.artifact_uri,
        "artifact_available": bool(mv.artifact_uri and Path(mv.artifact_uri).exists()),
        "class_labels": mv.class_labels,
        "metrics": version_metrics(mv, meta),
        "created_at": mv.created_at.isoformat(),
    }


@router.get("/datasets", dependencies=[ResearcherOrAdmin])
def datasets(request_id: RequestId):
    return success_body(dataset_summary(), request_id)


@router.get("/models", dependencies=[ResearcherOrAdmin])
def list_models(db: DbSession, request_id: RequestId):
    versions = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
    return success_body([_serialize_version(mv) for mv in versions], request_id)


@router.get("/models/active/class-metrics", dependencies=[ResearcherOrAdmin])
def active_class_metrics(db: DbSession, request_id: RequestId):
    mv = (
        db.query(ModelVersion)
        .filter_by(status=ModelVersionStatus.PRODUCTION.value)
        .order_by(ModelVersion.created_at.desc())
        .first()
    )
    if not mv:
        return success_body(None, request_id)
    meta = meta_for_version(mv) or {}
    report = parse_classification_report(meta.get("classification_report", "") or "")
    return success_body(
        {
            "model_version_id": mv.id,
            "model_name": mv.model.name,
            "version": mv.version,
            "available": bool(report["classes"]),
            "classes": report["classes"],
            "macro": report["macro"],
            "accuracy": version_metrics(mv, meta)["accuracy"],
            "note": None
            if report["classes"]
            else "No per-class evaluation report is recorded for the active model.",
        },
        request_id,
    )


@router.post("/models/{version_id}/promote", dependencies=[AdminOnly])
def promote_version(
    version_id: str,
    request: Request,
    db: DbSession,
    user: CurrentUser,
    request_id: RequestId,
):
    mv = db.get(ModelVersion, version_id)
    if not mv:
        raise AppError("NOT_FOUND", "Model version not found.", 404)
    if mv.status == ModelVersionStatus.PRODUCTION.value:
        raise AppError("ALREADY_ACTIVE", "This version is already the active model.", 409)
    if not mv.artifact_uri or not Path(mv.artifact_uri).exists():
        raise AppError(
            "ARTIFACT_MISSING",
            "The model artifact for this version is not available, so it cannot be promoted.",
            409,
        )

    previous = db.query(ModelVersion).filter_by(status=ModelVersionStatus.PRODUCTION.value).all()
    previous_ids = [p.id for p in previous]
    for p in previous:
        p.status = ModelVersionStatus.APPROVED.value
    from_status = mv.status
    mv.status = ModelVersionStatus.PRODUCTION.value
    record_audit(
        db,
        user.id,
        "model.promote",
        "model_version",
        mv.id,
        {
            "version": mv.version,
            "from_status": from_status,
            "demoted_version_ids": previous_ids,
        },
        request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(mv)
    return success_body(_serialize_version(mv), request_id)
