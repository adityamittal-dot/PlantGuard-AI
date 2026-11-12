from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


def _png() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (320, 320), (34, 120, 45)).save(buf, format="PNG")
    return buf.getvalue()


def _register(client: TestClient, email: str) -> dict:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass123!", "full_name": "Tester"},
    )
    assert reg.status_code == 200, reg.text
    return {"Authorization": f"Bearer {reg.json()['data']['tokens']['access_token']}"}


def test_report_pdf_owner_and_other_user() -> None:
    with TestClient(app) as client:
        owner = _register(client, "reportowner@example.com")
        other = _register(client, "reportother@example.com")

        up = client.post(
            "/api/v1/images/upload",
            headers=owner,
            files={"file": ("leaf.png", _png(), "image/png")},
        )
        assert up.status_code == 200, up.text
        created = client.post(
            "/api/v1/diagnoses", headers=owner, json={"image_id": up.json()["data"]["id"]}
        )
        assert created.status_code == 200, created.text
        did = created.json()["data"]["diagnosis_id"]

        res = client.get(f"/api/v1/diagnoses/{did}/report", headers=owner)
        assert res.status_code == 200, res.text
        assert res.headers["content-type"] == "application/pdf"
        assert "attachment" in res.headers["content-disposition"]
        assert res.content.startswith(b"%PDF")

        assert client.get(f"/api/v1/diagnoses/{did}/report", headers=other).status_code == 404
        assert client.get(f"/api/v1/diagnoses/{did}/report").status_code in {401, 403}
