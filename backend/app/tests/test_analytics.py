import csv
import io
from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app
from app.tests.helpers import add_diagnosis, login_admin, register


def _seed(uid: str) -> None:
    add_diagnosis(uid, datetime(2026, 3, 1, 9), "Fungi", 0.8, "good")
    add_diagnosis(uid, datetime(2026, 3, 1, 15), "Fungi", 0.6, "poor")
    add_diagnosis(uid, datetime(2026, 3, 3, 10), "Healthy", 1.0, "good")
    add_diagnosis(uid, datetime(2026, 3, 9, 10), "Virus", 0.7, "good")
    add_diagnosis(uid, datetime(2026, 3, 3, 12), None, None, "good", status="FAILED")


def test_timeseries_zero_filled_and_category_filter() -> None:
    with TestClient(app) as client:
        headers, uid = register(client, "an_ts@example.com")
        _seed(uid)
        res = client.get(
            "/api/v1/analytics/timeseries",
            params={"date_from": "2026-03-01", "date_to": "2026-03-04"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert [p["count"] for p in data["points"]] == [2, 0, 2, 0]
        assert data["total"] == 4

        res = client.get(
            "/api/v1/analytics/timeseries",
            params={"date_from": "2026-03-01", "date_to": "2026-03-04", "category": "Fungi"},
            headers=headers,
        )
        assert [p["count"] for p in res.json()["data"]["points"]] == [2, 0, 0, 0]


def test_distribution_summary_and_quality() -> None:
    with TestClient(app) as client:
        headers, uid = register(client, "an_dist@example.com")
        _seed(uid)
        params = {"date_from": "2026-03-01", "date_to": "2026-03-31"}
        dist = client.get("/api/v1/analytics/distribution", params=params, headers=headers)
        items = {i["label"]: i["count"] for i in dist.json()["data"]["items"]}
        assert items == {"Bacteria": 0, "Fungi": 2, "Healthy": 1, "Pests": 0, "Virus": 1}
        assert dist.json()["data"]["total"] == 4

        s = client.get("/api/v1/analytics/summary", params=params, headers=headers).json()["data"]
        assert s["total_diagnoses"] == 5
        assert s["completed_diagnoses"] == 4
        assert s["failed_diagnoses"] == 1
        assert s["healthy_detections"] == 1
        assert s["diseased_detections"] == 3
        assert abs(s["average_confidence"] - 0.775) < 1e-6
        quality = {q["status"]: q["count"] for q in s["quality_breakdown"]}
        assert quality == {"good": 4, "poor": 1}


def test_validation_errors() -> None:
    with TestClient(app) as client:
        headers, _ = register(client, "an_val@example.com")
        bad = client.get(
            "/api/v1/analytics/timeseries",
            params={"date_from": "2026-03-10", "date_to": "2026-03-01"},
            headers=headers,
        )
        assert bad.status_code == 422
        assert client.get(
            "/api/v1/analytics/distribution", params={"category": "Nope"}, headers=headers
        ).status_code == 422
        assert client.get("/api/v1/analytics/summary").status_code in {401, 403}


def test_export_csv_scoped_to_user_and_admin_sees_all() -> None:
    with TestClient(app) as client:
        a_headers, a_id = register(client, "an_csv_a@example.com")
        b_headers, b_id = register(client, "an_csv_b@example.com")
        add_diagnosis(a_id, datetime(2025, 5, 1, 9), "Pests", 0.5)
        add_diagnosis(b_id, datetime(2025, 5, 2, 9), "Virus", 0.7)
        params = {"date_from": "2025-05-01", "date_to": "2025-05-31"}

        res = client.get("/api/v1/analytics/export.csv", params=params, headers=a_headers)
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert "attachment" in res.headers["content-disposition"]
        rows = list(csv.DictReader(io.StringIO(res.text)))
        assert [r["top_prediction"] for r in rows] == ["Pests"]
        assert "user_email" not in rows[0]

        admin = login_admin(client)
        res = client.get("/api/v1/analytics/export.csv", params=params, headers=admin)
        rows = list(csv.DictReader(io.StringIO(res.text)))
        assert {r["top_prediction"] for r in rows} == {"Pests", "Virus"}
        assert {r["user_email"] for r in rows} == {"an_csv_a@example.com", "an_csv_b@example.com"}

        res = client.get(
            "/api/v1/analytics/export.csv", params={**params, "category": "Virus"}, headers=admin
        )
        assert len(list(csv.DictReader(io.StringIO(res.text)))) == 1
