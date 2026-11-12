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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/overview` | Researcher+ | KPI summary |
| GET | `/analytics/diseases` | Researcher+ | Disease distribution |
| GET | `/analytics/crops` | Researcher+ | Crop distribution |
| GET | `/analytics/trends` | Researcher+ | Time series |

## Research

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/datasets` | Researcher+ | List datasets |
| POST | `/datasets` | Researcher+ | Create |
| POST | `/datasets/{id}/versions` | Researcher+ | New version |
| GET | `/models` | Researcher+ | Registry |
| POST | `/training-runs` | Researcher+ | Launch training |
| GET | `/training-runs/{id}` | Researcher+ | Run status |

## Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | Admin | User management |
| PATCH | `/admin/users/{id}` | Admin | Role/status updates |
| GET | `/admin/audit-logs` | Admin | Audit trail |
| GET | `/admin/system-health` | Admin | Health snapshot |

## Cross-cutting requirements

Every protected endpoint must enforce authentication, authorization, input validation (Pydantic), structured logging with `request_id`, and standardized errors. Rate limiting applies especially to auth, upload, and inference endpoints.
