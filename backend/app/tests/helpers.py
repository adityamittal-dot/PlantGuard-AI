from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models import Diagnosis, Image, Prediction, User


def register(client: TestClient, email: str) -> tuple[dict, str]:
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass123!", "full_name": "Tester"},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    return {"Authorization": f"Bearer {data['tokens']['access_token']}"}, data["user"]["id"]


def set_role(user_id: str, role: str) -> None:
    db = SessionLocal()
    try:
        db.get(User, user_id).role = role
        db.commit()
    finally:
        db.close()


def login_admin(client: TestClient) -> dict:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@plantguard.ai", "password": "ChangeMeAdmin123!"},
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['data']['tokens']['access_token']}"}


def user_with_role(client: TestClient, email: str, role: str) -> tuple[dict, str]:
    headers, uid = register(client, email)
    set_role(uid, role)
    return headers, uid


def add_diagnosis(
    user_id: str,
    created_at: datetime,
    label: Optional[str],
    confidence: Optional[float] = 0.9,
    quality: str = "good",
    status: str = "COMPLETED",
) -> str:
    db = SessionLocal()
    try:
        img = Image(
            user_id=user_id,
            object_storage_key=f"k/{created_at.timestamp()}-{label}",
            filename="x.png",
            mime_type="image/png",
            file_size=1,
            checksum="c",
        )
        db.add(img)
        db.flush()
        d = Diagnosis(
            user_id=user_id,
            image_id=img.id,
            status=status,
            overall_confidence=confidence,
            quality_status=quality,
            created_at=created_at,
        )
        db.add(d)
        db.flush()
        if label:
            db.add(Prediction(diagnosis_id=d.id, label=label, probability=confidence or 0, rank=1))
        db.commit()
        return d.id
    finally:
        db.close()


def touch(path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x")
    return str(path)
