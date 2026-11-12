from pathlib import Path

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models import AuditLog, Model, ModelVersion
from app.services.research import parse_classification_report
from app.tests.helpers import login_admin, register, touch, user_with_role

REPORT = (
    "              precision    recall  f1-score   support\n\n"
    "    Bacteria     0.9992    0.9950    0.9971      1201\n"
    "       Fungi     0.9917    0.9950    0.9933      1200\n\n"
    "    accuracy                         0.9948      6003\n"
    "   macro avg     0.9948    0.9948    0.9948      6003\n"
)


def _add_version(tmp_path: Path, version: str, with_artifact: bool = True) -> str:
    db = SessionLocal()
    try:
        model = db.query(Model).first()
        uri = str(tmp_path / f"{version}.pt")
        if with_artifact:
            touch(Path(uri))
        mv = ModelVersion(
            model_id=model.id, version=version, artifact_uri=uri, status="candidate",
            accuracy=0.9, f1_score=0.88,
        )
        db.add(mv)
        db.commit()
        return mv.id
    finally:
        db.close()


def test_parse_classification_report() -> None:
    parsed = parse_classification_report(REPORT)
    assert [c["label"] for c in parsed["classes"]] == ["Bacteria", "Fungi"]
    assert parsed["classes"][0]["support"] == 1201
    assert parsed["macro"]["f1"] == 0.9948


def test_research_rbac_and_dataset() -> None:
    with TestClient(app) as client:
        user, _ = register(client, "rs_user@example.com")
        researcher, _ = user_with_role(client, "rs_res@example.com", "RESEARCHER")
        for path in ("/research/datasets", "/research/models", "/research/models/active/class-metrics"):
            assert client.get(f"/api/v1{path}", headers=user).status_code == 403
            assert client.get(f"/api/v1{path}").status_code in {401, 403}

        res = client.get("/api/v1/research/datasets", headers=researcher)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert {c["label"] for c in data["classes"]} == {"Bacteria", "Fungi", "Healthy", "Pests", "Virus"}
        assert data["total_images"] == sum(c["count"] for c in data["classes"])
        virus = next(c for c in data["classes"] if c["label"] == "Virus")
        assert virus["count"] == 3679


def test_model_registry_and_class_metrics() -> None:
    with TestClient(app) as client:
        researcher, _ = user_with_role(client, "rs_reg@example.com", "RESEARCHER")
        res = client.get("/api/v1/research/models", headers=researcher)
        assert res.status_code == 200, res.text
        rows = res.json()["data"]
        assert any(r["is_active"] for r in rows)
        assert {"metrics", "status", "version", "artifact_available"} <= rows[0].keys()
        cm = client.get("/api/v1/research/models/active/class-metrics", headers=researcher)
        assert cm.status_code == 200
        assert "available" in cm.json()["data"]


def test_promote_admin_only_with_audit(tmp_path: Path) -> None:
    with TestClient(app) as client:
        user, _ = register(client, "rs_promo_user@example.com")
        researcher, _ = user_with_role(client, "rs_promo_res@example.com", "RESEARCHER")
        admin = login_admin(client)
        vid = _add_version(tmp_path, "promo-test-v2")
        missing = _add_version(tmp_path, "promo-test-missing", with_artifact=False)

        url = f"/api/v1/research/models/{vid}/promote"
        assert client.post(url, headers=user).status_code == 403
        assert client.post(url, headers=researcher).status_code == 403
        assert client.post(url).status_code in {401, 403}

        assert client.post(f"/api/v1/research/models/{missing}/promote", headers=admin).status_code == 409
        assert client.post("/api/v1/research/models/nope/promote", headers=admin).status_code == 404

        ok = client.post(url, headers=admin)
        assert ok.status_code == 200, ok.text
        assert ok.json()["data"]["status"] == "production"

        rows = client.get("/api/v1/research/models", headers=admin).json()["data"]
        assert [r["id"] for r in rows if r["is_active"]] == [vid]
        assert client.post(url, headers=admin).status_code == 409

        db = SessionLocal()
        try:
            log = db.query(AuditLog).filter_by(action="model.promote", resource_id=vid).one()
            assert log.user_id is not None
            assert log.metadata_json["version"] == "promo-test-v2"
        finally:
            db.close()
