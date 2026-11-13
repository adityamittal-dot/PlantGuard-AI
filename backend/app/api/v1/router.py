from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    ai,
    analytics,
    auth,
    diagnoses,
    images,
    knowledge,
    research,
    storage,
    system,
    users,
)

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(images.router)
api_router.include_router(diagnoses.router)
api_router.include_router(ai.router)
api_router.include_router(knowledge.router)
api_router.include_router(analytics.router)
api_router.include_router(storage.router)
api_router.include_router(research.router)
api_router.include_router(admin.router)
