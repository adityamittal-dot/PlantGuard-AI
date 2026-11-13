from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_

from app.api.deps import CurrentUser, DbSession, RequestId, require_roles
from app.core.errors import AppError, success_body
from app.models import AuditLog, RefreshToken, User
from app.models.entities import UserRole, utcnow
from app.schemas.api import AdminUserUpdate
from app.services.audit import record_audit

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


def _user_out(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_verified": u.is_verified,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat(),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


@router.get("/users")
def list_users(
    db: DbSession,
    request_id: RequestId,
    q: Optional[str] = Query(None, max_length=100, description="Search email or name"),
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.query(User)
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(User.email.ilike(like), User.full_name.ilike(like))
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    total = query.count()
    items = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return success_body(
        {
            "total": total,
            "limit": limit,
            "offset": offset,
            "roles": [r.value for r in UserRole],
            "items": [_user_out(u) for u in items],
        },
        request_id,
    )


def _active_admin_count(db) -> int:
    return db.query(User).filter_by(role=UserRole.ADMIN.value, is_active=True).count()


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    request: Request,
    db: DbSession,
    admin: CurrentUser,
    request_id: RequestId,
):
    if payload.role is None and payload.is_active is None:
        raise AppError("VALIDATION_ERROR", "Provide role and/or is_active.", 422)
    if payload.role is not None and payload.role not in {r.value for r in UserRole}:
        raise AppError(
            "INVALID_ROLE",
            f"role must be one of: {', '.join(r.value for r in UserRole)}.",
            422,
        )
    target = db.get(User, user_id)
    if not target:
        raise AppError("NOT_FOUND", "User not found.", 404)

    role_changing = payload.role is not None and payload.role != target.role
    status_changing = payload.is_active is not None and payload.is_active != target.is_active

    if target.id == admin.id and (role_changing or status_changing):
        raise AppError(
            "SELF_MODIFICATION",
            "You cannot change your own role or active status.",
            400,
        )
    loses_admin = target.role == UserRole.ADMIN.value and target.is_active and (
        (role_changing and payload.role != UserRole.ADMIN.value)
        or (status_changing and payload.is_active is False)
    )
    if loses_admin and _active_admin_count(db) <= 1:
        raise AppError("LAST_ADMIN", "At least one active admin must remain.", 409)

    ip = request.client.host if request.client else None
    if role_changing:
        record_audit(
            db, admin.id, "user.role_change", "user", target.id,
            {"email": target.email, "from": target.role, "to": payload.role}, ip,
        )
        target.role = payload.role
    if status_changing:
        record_audit(
            db, admin.id,
            "user.activate" if payload.is_active else "user.deactivate",
            "user", target.id, {"email": target.email}, ip,
        )
        target.is_active = bool(payload.is_active)
        if not target.is_active:
            # Deactivation also ends existing refresh sessions.
            db.query(RefreshToken).filter(
                RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None)
            ).update({"revoked_at": utcnow()})
    db.commit()
    db.refresh(target)
    return success_body(_user_out(target), request_id)


@router.get("/audit-logs")
def list_audit_logs(
    db: DbSession,
    request_id: RequestId,
    action: Optional[str] = Query(None, max_length=128),
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if date_from and date_to and date_from > date_to:
        raise AppError("INVALID_RANGE", "date_from must be on or before date_to.", 422)
    query = db.query(AuditLog, User.email).outerjoin(User, User.id == AuditLog.user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if date_from:
        query = query.filter(
            AuditLog.created_at >= datetime.combine(date_from, datetime.min.time())
        )
    if date_to:
        query = query.filter(
            AuditLog.created_at
            < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )
    total = query.count()
    rows = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    actions = [a for (a,) in db.query(AuditLog.action).distinct().order_by(AuditLog.action).all()]
    return success_body(
        {
            "total": total,
            "limit": limit,
            "offset": offset,
            "actions": actions,
            "items": [
                {
                    "id": log.id,
                    "action": log.action,
                    "user_id": log.user_id,
                    "user_email": email,
                    "resource_type": log.resource_type,
                    "resource_id": log.resource_id,
                    "metadata": log.metadata_json,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at.isoformat(),
                }
                for log, email in rows
            ],
        },
        request_id,
    )
