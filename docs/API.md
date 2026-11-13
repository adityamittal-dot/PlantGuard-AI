# PlantGuard AI — API Catalogue

Base path: `/api/v1`  
OpenAPI: `/docs` · ReDoc: `/redoc`

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "INVALID_IMAGE",
    "message": "Uploaded image is not supported.",
    "details": {}
  },
  "request_id": "…"
}
```

Success responses use a consistent envelope with `success: true` and a `data` payload (Phase 3+).

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create account |
| POST | `/auth/login` | Public | Issue access + refresh tokens |
| POST | `/auth/refresh` | Refresh | Rotate tokens |
| POST | `/auth/logout` | Auth | Revoke refresh session |
| POST | `/auth/forgot-password` | Public | Start reset flow |
| POST | `/auth/reset-password` | Public | Complete reset |

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Auth | Current profile |
| PATCH | `/users/me` | Auth | Update profile |
| GET | `/users/me/activity` | Auth | Recent activity |

## Images

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/images/upload` | Auth | Multipart upload; MIME/size/resolution checks |
| GET | `/images/{id}` | Owner+ | Metadata + signed URL |
| DELETE | `/images/{id}` | Owner+ | Soft/hard delete per policy |

## Diagnosis

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/diagnoses` | Auth | Create diagnosis job from image_id |
| GET | `/diagnoses` | Auth | List (paginated, filtered) |
| GET | `/diagnoses/{id}` | Owner/Expert | Full diagnosis |
| DELETE | `/diagnoses/{id}` | Owner/Admin | Delete |
| GET | `/diagnoses/{id}/report` | Owner only | PDF report (`application/pdf`, attachment). 404 if not the owner's diagnosis |
| GET | `/diagnoses/{id}/explanation` | Owner/Expert | XAI artifacts |

## AI

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/ai/inference` | Auth | Trigger/queue inference |
| GET | `/ai/jobs/{job_id}` | Auth | Job state machine |
| GET | `/ai/models/active` | Auth | Production model metadata |

Job states: `QUEUED` | `PROCESSING` | `COMPLETED` | `FAILED` | `CANCELLED`

## Diseases & crops

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/diseases` | Public/Auth | Searchable list |
| GET | `/diseases/{slug}` | Public/Auth | Detail |
| POST | `/diseases` | Admin/Expert | Create |
| PATCH | `/diseases/{id}` | Admin/Expert | Update |
| DELETE | `/diseases/{id}` | Admin | Delete |
| GET | `/crops` | Public/Auth | List |
| GET | `/crops/{id}` | Public/Auth | Detail |

## Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reports` | Auth | Queue report |
| GET | `/reports/{id}` | Owner+ | Status/metadata |
| GET | `/reports/{id}/download` | Owner+ | Signed download |

## Analytics

Scoped to the caller's own diagnoses; admins see all users. Shared query params
(all optional): `date_from`, `date_to` (inclusive, `YYYY-MM-DD`, max 366 days apart)
and `category` (one of `Bacteria`, `Fungi`, `Healthy`, `Pests`, `Virus`, matched on the
top prediction). Invalid ranges/categories return 422.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/overview` | Auth | Unfiltered KPI summary (dashboard) |
| GET | `/analytics/timeseries` | Auth | Zero-filled daily diagnosis counts (default: last 30 days) |
| GET | `/analytics/distribution` | Auth | Category distribution of completed diagnoses |
| GET | `/analytics/summary` | Auth | KPIs, average confidence (overall + per category), quality-status breakdown |
| GET | `/analytics/export.csv` | Auth | CSV download of diagnoses (admins also get `user_email`) |

## Research

Roles: `RESEARCHER` or `ADMIN` (admin always passes `require_roles`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/research/datasets` | Researcher+ | Class counts parsed from `ml/datasets/DATASET.md` (seeded fallback); no downloads |
| GET | `/research/models` | Researcher+ | Model registry: versions with status, metrics (DB columns, falling back to the `*.meta.json` beside the artifact) and `artifact_available` |
| GET | `/research/models/active/class-metrics` | Researcher+ | Per-class precision/recall/F1/support of the production version (from its meta.json classification report); `null` if no active model |
| POST | `/research/models/{version_id}/promote` | Admin | Make a version `production`; previous production versions become `approved`. 404 unknown, 409 already active or artifact missing. Writes `model.promote` audit row |

Planned (not implemented): `POST /datasets`, `POST /datasets/{id}/versions`, `/training-runs`.

## Admin

All endpoints require `ADMIN`. Every mutation writes an `audit_logs` row.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | Admin | Paginated list; params `q` (email/name), `role`, `is_active`, `limit` (1-200, default 50), `offset`. Returns `{total, limit, offset, roles, items}` |
| PATCH | `/admin/users/{id}` | Admin | Body `{role?, is_active?}`. Audit actions `user.role_change`, `user.activate`, `user.deactivate`. Deactivation revokes refresh tokens. 400 `SELF_MODIFICATION` for own account, 409 `LAST_ADMIN`, 422 invalid role |
| GET | `/admin/audit-logs` | Admin | Paginated, newest first; filters `action`, `user_id`, `resource_type`, `date_from`, `date_to`; returns `actions` (distinct action names) for filter UIs |
| GET | `/admin/system-health` | Admin | Planned (Phase 16) |

Audit action names written so far: `model.promote`, `user.role_change`, `user.activate`, `user.deactivate`.

## Cross-cutting requirements

Every protected endpoint must enforce authentication, authorization, input validation (Pydantic), structured logging with `request_id`, and standardized errors. Rate limiting applies especially to auth, upload, and inference endpoints.
