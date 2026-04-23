from fastapi import APIRouter

from app.core.config import settings
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(version=settings.version)


@router.get("/ready")
def ready():
    return {"success": True, "status": "ready"}
