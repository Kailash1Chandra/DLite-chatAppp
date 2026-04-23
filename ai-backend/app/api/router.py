from fastapi import APIRouter

from app.api.routes import generate_router, health_router, speech_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(generate_router)
api_router.include_router(speech_router)
