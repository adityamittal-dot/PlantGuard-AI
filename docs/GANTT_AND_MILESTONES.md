# PlantGuard AI — 16-Week Gantt & Milestones

## Weekly Gantt

| Week | Focus | Primary deliverable |
|------|-------|---------------------|
| W1 | Foundation | Repo, Docker, schema plan, design system kickoff |
| W2 | Auth + Shell | Login/Register, JWT, RBAC, app shell |
| W3 | Landing + Dashboard | Home, KPIs, profile shell |
| W4 | Analyze UX | Upload, camera, validation UI |
| W5 | Image Backend | Object storage, jobs, preprocessing |
| W6 | Inference | Baseline CNN + inference API |
| W7 | Diagnosis + XAI | Results page, Grad-CAM |
| W8 | Knowledge | Diseases + Crops catalog |
| W9 | History + Reports | History table, PDF engine |
| W10 | Analytics | Charts, export, filters |
| W11 | Research UI | Datasets + model registry UI |
| W12 | Training Ops | Experiments, evaluation, promote |
| W13 | Admin | Users, approvals, audit |
| W14 | Security/Obs | Rate limits, logging, monitoring |
| W15 | Testing | API/FE/E2E/ML regression |
| W16 | Deploy | Prod build, docs, demo |

## Milestones

| ID | Phases | Title | Exit criteria |
|----|--------|-------|---------------|
| M1 | 1–3 | Platform foundation | Auth, migrations, design system, Compose healthy |
| M2 | 4–6 | Diagnosis MVP | Upload → quality → inference → persisted diagnosis |
| M3 | 7–10 | Explain + Knowledge | Grad-CAM, disease/crop pages, reports, analytics |
| M4 | 11–14 | Research + Admin | Dataset/model lifecycle, governance, monitoring |
| M5 | 15–18 | Production ready | Tests green, deployable stack, full docs |

## Implementation phase order

1. Repo + architecture + environment
2. Database + migrations
3. Authentication + RBAC
4. Frontend design system
5. Image upload/storage
6. ML preprocessing
7. Model training
8. Inference service
9. Diagnosis results
10. Explainable AI
11. Knowledge center
12. Reports
13. Analytics
14. Research dashboard
15. Admin dashboard
16. Monitoring
17. Testing
18. Deployment

## Phase progress (13-15)

| Phase | Status | Delivered |
|-------|--------|-----------|
| 13 Analytics | Done | Filtered timeseries/distribution/summary endpoints, CSV export, `/analytics` page (KPIs, charts, date + category filters) |
| 14 Research dashboard | Done (partial scope) | Dataset summary, model registry, admin-only promote with audit, `/research` page. Not yet: dataset create/versioning, training-run launch |
| 15 Admin dashboard | Done | User search/role/activation, audit-log filters, `/admin` page. Not yet: signup approvals, `/admin/system-health` (Phase 16) |
