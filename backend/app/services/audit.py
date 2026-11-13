from typing import Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def record_audit(
    db: Session,
    user_id: Optional[str],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Add an audit row to the caller's transaction (caller commits)."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json=metadata or {},
        ip_address=ip_address,
    )
    db.add(entry)
    return entry
