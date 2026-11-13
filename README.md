# PlantGuard AI — Plant Pathogen Detection & Classification

An image-based plant disease diagnosis platform: upload a leaf photo and get a
visual symptom classification (Bacteria / Fungi / Healthy / Pests / Virus),
a confidence score, a Grad-CAM explanation of what the model looked at, and
sourced disease/recommendation information — served through a FastAPI backend
and a Next.js frontend.

**Scientific framing:** predictions are *visual symptom-category*
classification, not laboratory-confirmed pathogen identification. A "Fungi"
result means the image looks consistent with fungal symptoms — not that a
lab has confirmed a specific fungal species. See
[`docs/ML_PIPELINE.md`](docs/ML_PIPELINE.md).

## Repository layout

| Path | What's there |
|------|--------------|
| `backend/` | FastAPI app — auth, diagnosis pipeline, inference, knowledge base, reports |
| `frontend/` | Next.js app (analysis UI, dashboards, disease/crop knowledge center) |
| `ml/` | Dataset download + CNN training scripts (kept out of `backend/`'s runtime deps) |
| `infra/` | nginx config, CI workflow template |
| `docs/` | Architecture, API, database, deployment, security, and research docs |

## Quick start (one command)

```bash
./start.sh
```

Installs backend/frontend dependencies on first run, then starts the API
(`http://localhost:8000/docs`) and the web app (`http://localhost:3000`).
Ctrl+C stops both.

**Test accounts** (seeded automatically on first start, local use only):

| Role | Email | Password |
|------|-------|----------|
| User | `test@plantguard.ai` | `TestUser123!` |
| Admin | `admin@plantguard.ai` | `ChangeMeAdmin123!` |

The sections below cover running each part manually.

## Quick start (backend)

The API runs standalone against SQLite and local disk storage — no Docker,
Postgres, or Redis required for local development.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for interactive API docs. On first run the
app seeds its SQLite database and bootstraps a lightweight sklearn classifier
automatically, so predictions work immediately — see [Model](#model) below
for training the real CNN.

Run the test suite:

```bash
pytest -q
```

## Quick start (frontend)

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:3000` and defaults to an API at
`http://localhost:8000/api/v1` (override with `NEXT_PUBLIC_API_BASE_URL` in
`frontend/.env.local` — see `frontend/lib/api.ts`).

## Model

Inference (`backend/app/ml/inference_engine.py`) prefers a trained CNN at
`backend/models/production_cnn.pt` and falls back to a bundled sklearn
baseline when it's absent — so the app works out of the box, with the CNN as
an opt-in upgrade:

```bash
pip install -r ml/requirements.txt
python ml/datasets/download.py                          # fetch the dataset (needs Kaggle credentials)
python ml/training/train_cnn.py --data ml/datasets/raw --out backend/models \
  --arch resnet18 --epochs 8 --batch-size 32 --workers 0
```

Restart the API afterward to pick up the new checkpoint. Full walkthrough:
[`docs/TRAINING.md`](docs/TRAINING.md). Dataset details:
[`ml/datasets/DATASET.md`](ml/datasets/DATASET.md). A prior full-dataset run
reached 99.5% test accuracy / macro F1 with this pipeline — see
[`docs/RESULTS.md`](docs/RESULTS.md). Trained weights aren't checked into git
(gitignored, regenerate via training) — only the code and metrics are.

## Documentation

| Doc | Covers |
|-----|--------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System layers, end-to-end flow |
| [`docs/API.md`](docs/API.md) | REST endpoint catalogue |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema |
| [`docs/ML_PIPELINE.md`](docs/ML_PIPELINE.md) | Inference/training pipeline, evaluation methodology |
| [`docs/TRAINING.md`](docs/TRAINING.md) | Step-by-step CNN training |
| [`docs/RESULTS.md`](docs/RESULTS.md) | Latest training run metrics |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth, RBAC, upload validation |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Target production/Docker architecture |
| [`docs/RESEARCH_METHODOLOGY.md`](docs/RESEARCH_METHODOLOGY.md) | Reproducibility, dataset versioning notes |
| [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md) / [`docs/DEPENDENCY_MAP.md`](docs/DEPENDENCY_MAP.md) | Codebase map |
| [`docs/GANTT_AND_MILESTONES.md`](docs/GANTT_AND_MILESTONES.md) | Project timeline |

`docs/DEPLOYMENT.md` describes the target Docker Compose / cloud architecture;
the compose file and `.env.example` it references aren't in the repo yet —
today's verified path is the local SQLite quick start above.
