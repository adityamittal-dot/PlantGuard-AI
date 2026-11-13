from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models import AuditLog
from app.tests.helpers import login_admin, register, user_with_role


def test_admin_endpoints_forbidden_for_non_admins() -> None:
    with TestClient(app) as client:
        user, uid = register(client, "ad_user@example.com")
        researcher, _ = user_with_role(client, "ad_res@example.com", "RESEARCHER")
        for headers in (user, researcher):
            assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
            assert client.get("/api/v1/admin/audit-logs", headers=headers).status_code == 403
            assert (
                client.patch(f"/api/v1/admin/users/{uid}", json={"role": "ADMIN"}, headers=headers).status_code
                == 403
            )
        assert client.get("/api/v1/admin/users").status_code in {401, 403}
    # The attempted self-promotion must not have taken effect.
    db = SessionLocal()
    try:
        from app.models import User

        assert db.get(User, uid).role == "USER"
    finally:
        db.close()


def test_list_search_and_filter_users() -> None:
    with TestClient(app) as client:
        register(client, "ad_search_zebra@example.com")
        admin = login_admin(client)
        res = client.get("/api/v1/admin/users", params={"q": "ad_search_zebra"}, headers=admin)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["email"] == "ad_search_zebra@example.com"
        assert "password_hash" not in data["items"][0]
        assert "ADMIN" in data["roles"]
        res = client.get("/api/v1/admin/users", params={"role": "ADMIN"}, headers=admin)
        assert all(u["role"] == "ADMIN" for u in res.json()["data"]["items"])


def test_role_change_and_deactivate_write_audit_and_block_login() -> None:
    with TestClient(app) as client:
        _, uid = register(client, "ad_target@example.com")
        admin = login_admin(client)

        res = client.patch(f"/api/v1/admin/users/{uid}", json={"role": "RESEARCHER"}, headers=admin)
        assert res.status_code == 200, res.text
        assert res.json()["data"]["role"] == "RESEARCHER"

        res = client.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False}, headers=admin)
        assert res.json()["data"]["is_active"] is False
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "ad_target@example.com", "password": "SecurePass123!"},
        )
        assert login.status_code >= 400

        client.patch(f"/api/v1/admin/users/{uid}", json={"is_active": True}, headers=admin)

        logs = client.get(
            "/api/v1/admin/audit-logs", params={"resource_type": "user"}, headers=admin
        ).json()["data"]
        mine = [l for l in logs["items"] if l["resource_id"] == uid]
        assert {l["action"] for l in mine} == {"user.role_change", "user.deactivate", "user.activate"}
        change = next(l for l in mine if l["action"] == "user.role_change")
        assert change["metadata"]["from"] == "USER" and change["metadata"]["to"] == "RESEARCHER"
        assert change["user_email"] == "admin@plantguard.ai"
        assert "user.deactivate" in logs["actions"]

        only = client.get(
            "/api/v1/admin/audit-logs", params={"action": "user.deactivate"}, headers=admin
        ).json()["data"]
        assert only["items"] and all(l["action"] == "user.deactivate" for l in only["items"])


def test_update_validation_and_guards() -> None:
    with TestClient(app) as client:
        _, uid = register(client, "ad_guard@example.com")
        admin = login_admin(client)
        assert client.patch(f"/api/v1/admin/users/{uid}", json={}, headers=admin).status_code == 422
        assert (
            client.patch(f"/api/v1/admin/users/{uid}", json={"role": "ROOT"}, headers=admin).status_code
            == 422
        )
        assert client.patch("/api/v1/admin/users/nope", json={"role": "USER"}, headers=admin).status_code == 404

        me = client.get("/api/v1/users/me", headers=admin).json()["data"]["id"]
        res = client.patch(f"/api/v1/admin/users/{me}", json={"is_active": False}, headers=admin)
        assert res.status_code == 400 and res.json()["error"]["code"] == "SELF_MODIFICATION"

        # No-op change writes no audit row.
        db = SessionLocal()
        try:
            before = db.query(AuditLog).count()
        finally:
            db.close()
        client.patch(f"/api/v1/admin/users/{uid}", json={"role": "USER"}, headers=admin)
        db = SessionLocal()
        try:
            assert db.query(AuditLog).count() == before
        finally:
            db.close()


def test_audit_log_date_filter_validation() -> None:
    with TestClient(app) as client:
        admin = login_admin(client)
        res = client.get(
            "/api/v1/admin/audit-logs",
            params={"date_from": "2026-02-02", "date_to": "2026-01-01"},
            headers=admin,
        )
        assert res.status_code == 422
